"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { proximoNumero } from "@/lib/contador";
import { MAX_FOTOS_PEDIDO, type Pedido, type PedidoInput, pedidoSchema } from "@/lib/types";
import { randomUUID } from "node:crypto";
import { excluirArquivoAnexo, salvarAnexo } from "@/lib/anexos-storage";

import { formatarCodigo } from "@/lib/codigo";
import { resolverAtendimentoId } from "@/server/crm";

/** Como a foto fica gravada no documento do pedido. */
interface FotoSalva {
  id: string;
  chave: string;
  tipo: string;
  criadaEm: Date;
}

const TAMANHO_MAXIMO_FOTO_BYTES = 8 * 1024 * 1024; // 8MB (o navegador já reduz antes de enviar)
const TIPOS_FOTO_ACEITOS = ["image/jpeg", "image/png"]; // os que o gerador de PDF lê

function toPedido(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): Pedido {
  const data = doc.data()!;
  return {
    id: doc.id,
    numero: data.numero,
    cadastroId: data.cadastroId,
    cadastroNome: data.cadastroNome,
    itens: data.itens ?? [],
    observacao: data.observacao ?? "",
    total: data.total ?? 0,
    status: data.status ?? "ORCAMENTO",
    custoSugerido: typeof data.custoSugerido === "number" ? data.custoSugerido : null,
    // A chave do arquivo no storage não sai do servidor; a tela usa a rota da foto.
    fotos: ((data.fotos ?? []) as FotoSalva[]).map((f) => ({
      id: f.id,
      url: `/api/pedidos/${doc.id}/fotos/${f.id}`,
    })),
    createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? "",
  };
}

export async function listarPedidos(): Promise<Pedido[]> {
  const snap = await db.collection("pedidos").orderBy("createdAt", "desc").get();
  return snap.docs.map(toPedido);
}

export async function buscarPedido(id: string): Promise<Pedido | null> {
  const doc = await db.collection("pedidos").doc(id).get();
  if (!doc.exists) return null;
  return toPedido(doc);
}

export async function criarPedido(input: PedidoInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const parsed = pedidoSchema.parse(input);
  const total = parsed.itens.reduce((soma, item) => soma + item.quantidade * item.precoUnitario, 0);
  const numero = await proximoNumero("pedido_numero");
  const now = new Date();

  const ref = await db.collection("pedidos").add({
    ...parsed,
    numero,
    total,
    status: parsed.status ?? "ORCAMENTO",
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/pedidos");
  return { id: ref.id, numero };
}

export async function atualizarPedido(id: string, input: PedidoInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const parsed = pedidoSchema.parse(input);
  const total = parsed.itens.reduce((soma, item) => soma + item.quantidade * item.precoUnitario, 0);
  const now = new Date();

  await db.collection("pedidos").doc(id).update({
    ...parsed,
    total,
    updatedAt: now,
  });

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${id}`);
}


export async function converterEmPedido(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const pedido = await buscarPedido(id);
  if (!pedido) throw new Error("Pedido não encontrado");
  if (pedido.status === "PEDIDO") {
    throw new Error(`O orçamento ${formatarCodigo(pedido.numero)} já foi transformado em pedido.`);
  }

  const now = new Date();

  // Atualiza o status do pedido para PEDIDO
  await db.collection("pedidos").doc(id).update({
    status: "PEDIDO",
    updatedAt: now,
  });

  // Cria interação no CRM para o cadastro como "Pedido Feito" (GANHO)
  const atendimentoId = await resolverAtendimentoId(pedido.cadastroId);
  const codigo = formatarCodigo(pedido.numero);

  await db.collection("interacoes").add({
    cadastroId: pedido.cadastroId,
    tipo: "NOTA",
    descricao: `ORÇAMENTO #${codigo} TRANSFORMADO EM PEDIDO`,
    data: now,
    dataReagendamento: null,
    valorEstimado: pedido.total,
    etapa: "GANHO",
    atendimentoId,
    usuarioId: session.user.id,
    usuarioNome: session.user.name ?? null,
    createdAt: now,
  });

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/crm");
  revalidatePath(`/cadastros/${pedido.cadastroId}`);
}

/** Grava (ou apaga, com null) o custo sugerido da mercadoria do pedido/orçamento. */
export async function definirCustoSugerido(id: string, valor: number | null) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  if (valor !== null && (!Number.isFinite(valor) || valor < 0)) {
    throw new Error("Informe um custo sugerido válido.");
  }

  const ref = db.collection("pedidos").doc(id);
  if (!(await ref.get()).exists) throw new Error("Pedido não encontrado");

  await ref.update({
    custoSugerido: valor === null ? null : Math.round(valor * 100) / 100,
    updatedAt: new Date(),
  });

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${id}`);
}

/** Adiciona uma foto ao orçamento/pedido (FormData com o campo "foto"). */
export async function enviarFotoPedido(pedidoId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const arquivo = formData.get("foto");
  if (!(arquivo instanceof File) || arquivo.size === 0) throw new Error("Nenhuma foto recebida.");
  if (!TIPOS_FOTO_ACEITOS.includes(arquivo.type)) throw new Error("Envie a foto em JPG ou PNG.");
  if (arquivo.size > TAMANHO_MAXIMO_FOTO_BYTES) throw new Error("A foto passa do limite de 8MB.");

  const ref = db.collection("pedidos").doc(pedidoId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("Pedido não encontrado");

  const fotos = (doc.data()!.fotos ?? []) as FotoSalva[];
  if (fotos.length >= MAX_FOTOS_PEDIDO) {
    throw new Error(`O limite é de ${MAX_FOTOS_PEDIDO} fotos por orçamento.`);
  }

  const id = randomUUID();
  const chave = `pedidos/${pedidoId}/fotos/${id}`;
  await salvarAnexo(chave, Buffer.from(await arquivo.arrayBuffer()));

  const nova: FotoSalva = { id, chave, tipo: arquivo.type, criadaEm: new Date() };
  await ref.update({ fotos: [...fotos, nova], updatedAt: new Date() });

  revalidatePath(`/pedidos/${pedidoId}`);
}

export async function excluirFotoPedido(pedidoId: string, fotoId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const ref = db.collection("pedidos").doc(pedidoId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("Pedido não encontrado");

  const fotos = (doc.data()!.fotos ?? []) as FotoSalva[];
  const foto = fotos.find((f) => f.id === fotoId);
  if (!foto) return;

  await ref.update({ fotos: fotos.filter((f) => f.id !== fotoId), updatedAt: new Date() });
  await excluirArquivoAnexo(foto.chave);

  revalidatePath(`/pedidos/${pedidoId}`);
}

export async function excluirPedido(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const ref = db.collection("pedidos").doc(id);
  const fotos = ((await ref.get()).data()?.fotos ?? []) as FotoSalva[];

  await ref.delete();
  // Remove também os arquivos das fotos; falha em um não impede os outros.
  await Promise.allSettled(fotos.map((f) => excluirArquivoAnexo(f.chave)));

  revalidatePath("/pedidos");
}
