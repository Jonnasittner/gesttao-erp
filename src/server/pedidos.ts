"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { proximoNumero } from "@/lib/contador";
import { type Pedido, type PedidoInput, pedidoSchema } from "@/lib/types";

import { formatarCodigo } from "@/lib/codigo";
import { resolverAtendimentoId } from "@/server/crm";

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

export async function excluirPedido(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  await db.collection("pedidos").doc(id).delete();

  revalidatePath("/pedidos");
}
