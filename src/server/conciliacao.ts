"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { comResultado } from "@/lib/resultado";
import { excluirArquivoAnexo, salvarAnexo } from "@/lib/anexos-storage";
import { proximoNumero } from "@/lib/contador";
import { configAsaas } from "@/lib/asaas";
import { rotuloClasse, rotuloDocumento, urlComprovante } from "@/lib/financeiro";
import { camposDaClasse } from "@/lib/classes-despesa";
import { formatarCodigo } from "@/lib/codigo";
import {
  formaPagamentoDaMovimentacao,
  LINK_CONCILIACAO,
  movimentacoesRef,
  rotuloTipoMovimentacao,
  sincronizarExtratoAsaas,
} from "@/lib/conciliacao";
import {
  CATEGORIA_CUSTO,
  type CategoriaCusto,
  type JustificativaMovimentacao,
  type MovimentacaoAsaas,
} from "@/lib/types";

async function exigirSessao() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");
  return session;
}

function toMovimentacao(doc: FirebaseFirestore.DocumentSnapshot): MovimentacaoAsaas {
  const d = doc.data()!;
  const j = d.justificativa;
  return {
    id: doc.id,
    ambiente: d.ambiente,
    data: d.data ?? "",
    valor: d.valor ?? 0,
    saldo: d.saldo ?? 0,
    tipo: d.tipo ?? "",
    descricao: d.descricao ?? "",
    contraparte: d.contraparte ?? "",
    paymentId: d.paymentId ?? "",
    transferId: d.transferId ?? "",
    status: d.status ?? "PENDENTE",
    justificativa: j
      ? {
          modo: j.modo,
          texto: j.texto ?? "",
          categoria: j.categoria ?? "",
          classe: j.classe ?? "",
          lancamentoId: j.lancamentoId ?? "",
          documento: j.documento ?? "",
          marcouPago: !!j.marcouPago,
          usuarioNome: j.usuarioNome ?? null,
          em: j.em?.toDate?.().toISOString() ?? "",
        }
      : null,
    comprovanteUrl: d.comprovante?.chave ? urlComprovante(doc.id) : "",
    criadaEm: d.criadaEm?.toDate?.().toISOString() ?? "",
  };
}

/** Quantas justificadas a tela mostra (as pendentes vêm todas). */
const MAX_JUSTIFICADAS = 200;
/** Por quanto tempo uma movimentação recém-chegada fica com o selo "Nova". */
const NOVA_POR_MS = 24 * 60 * 60_000;

/**
 * Pendentes (todas) e as justificadas mais recentes do ambiente atual do
 * Asaas. Duas consultas simples, sem índice composto.
 */
export async function listarMovimentacoes() {
  await exigirSessao();
  const ambiente = configAsaas()?.ambiente;
  const [pendentes, recentes] = await Promise.all([
    movimentacoesRef().where("status", "==", "PENDENTE").get(),
    movimentacoesRef().orderBy("data", "desc").limit(MAX_JUSTIFICADAS).get(),
  ]);
  const doAmbiente = (m: MovimentacaoAsaas) => !ambiente || m.ambiente === ambiente;
  const ordem = (a: MovimentacaoAsaas, b: MovimentacaoAsaas) =>
    b.data.localeCompare(a.data) || b.criadaEm.localeCompare(a.criadaEm);
  return {
    /** ISO: pendentes vistas pelo sistema depois disso ganham o selo "Nova". */
    novasDesde: new Date(Date.now() - NOVA_POR_MS).toISOString(),
    pendentes: pendentes.docs.map(toMovimentacao).filter(doAmbiente).sort(ordem),
    justificadas: recentes.docs
      .map(toMovimentacao)
      .filter((m) => m.status === "JUSTIFICADA" && doAmbiente(m))
      .sort(ordem),
  };
}

/** Botão "Atualizar": lê o extrato do Asaas agora, sem esperar os 5 minutos. */
export async function atualizarExtrato() {
  return comResultado(async () => {
    await exigirSessao();
    if (!configAsaas()) throw new Error("Asaas não configurado: defina ASAAS_API_KEY.");
    const novas = await sincronizarExtratoAsaas({ forcar: true });
    revalidatePath(LINK_CONCILIACAO);
    return novas;
  });
}

export interface ContaParaVincular {
  id: string;
  documento: string;
  nome: string;
  valor: number;
  vencimento: string;
  descricao: string;
}

/**
 * Contas pendentes do mesmo lado da movimentação (saída → a pagar, entrada →
 * a receber), as de valor mais próximo primeiro.
 */
export async function listarContasParaVincular(movimentacaoId: string) {
  return comResultado<ContaParaVincular[]>(async () => {
    await exigirSessao();
    const mov = await movimentacoesRef().doc(movimentacaoId).get();
    if (!mov.exists) throw new Error("Movimentação não encontrada.");
    const valor = Math.abs(mov.data()!.valor ?? 0);
    const tipo = (mov.data()!.valor ?? 0) < 0 ? "PAGAR" : "RECEBER";

    const snap = await db.collection("lancamentos").where("status", "==", "PENDENTE").get();
    return snap.docs
      .filter((d) => d.data().tipo === tipo)
      .map((d) => {
        const l = d.data();
        return {
          id: d.id,
          documento: rotuloDocumento(l.numeroDocumento ?? 0, l.parcela ?? 1, l.totalParcelas ?? 1),
          nome: (tipo === "PAGAR" ? l.fornecedorNome : l.clienteNome) || l.clienteNome || l.descricao || "",
          valor: l.valor ?? 0,
          vencimento: l.vencimento ?? "",
          descricao: l.descricao ?? "",
        };
      })
      .sort((a, b) => Math.abs(a.valor - valor) - Math.abs(b.valor - valor) || a.vencimento.localeCompare(b.vencimento))
      .slice(0, 100);
  });
}

/** Foto/PDF do cupom guardado na movimentação. */
interface ComprovanteSalvo {
  chave: string;
  tipo: string;
  nome: string;
}

const TAMANHO_MAXIMO_COMPROVANTE = 8 * 1024 * 1024; // o navegador já reduz as fotos antes
const TIPOS_COMPROVANTE = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** Lê e valida o campo "comprovante" do FormData (opcional). */
function arquivoComprovante(formData?: FormData): File | null {
  const arquivo = formData?.get("comprovante");
  if (!(arquivo instanceof File) || arquivo.size === 0) return null;
  if (!TIPOS_COMPROVANTE.includes(arquivo.type)) throw new Error("Envie o cupom como foto (JPG/PNG) ou PDF.");
  if (arquivo.size > TAMANHO_MAXIMO_COMPROVANTE) throw new Error("O cupom passa do limite de 8MB.");
  return arquivo;
}

export type PedidoJustificativa =
  | { modo: "VINCULADA"; lancamentoId: string; texto?: string }
  | {
      modo: "LANCADA";
      categoria: CategoriaCusto;
      /** Fornecedor/prestador cadastrado que recebeu o pagamento. */
      fornecedorId: string;
      classeId: string;
      subclasseId: string;
      texto: string;
      pedidoNumero?: number;
    }
  | { modo: "TEXTO"; texto: string };

/** `formData` pode trazer o campo "comprovante" (foto ou PDF do cupom). */
export async function justificarMovimentacao(movimentacaoId: string, pedido: PedidoJustificativa, formData?: FormData) {
  return comResultado(async () => {
    const session = await exigirSessao();
    const usuarioNome = session.user.name ?? null;
    const texto = ("texto" in pedido ? pedido.texto ?? "" : "").trim().toUpperCase();
    const movRef = movimentacoesRef().doc(movimentacaoId);

    if (pedido.modo === "TEXTO" && !texto) throw new Error("Escreva o que foi esta movimentação.");
    if (pedido.modo === "LANCADA" && !CATEGORIA_CUSTO.includes(pedido.categoria)) {
      throw new Error("Escolha o tipo do gasto.");
    }
    const arquivo = arquivoComprovante(formData);

    // Lançamento novo: número e pedido antes da transação (o contador tem a sua).
    let novoLancamento: {
      id: string;
      numeroDocumento: number;
      pedido: FirebaseFirestore.DocumentSnapshot | null;
      fornecedor: { id: string; nome: string };
      classe: Awaited<ReturnType<typeof camposDaClasse>>;
    } | null = null;
    if (pedido.modo === "LANCADA") {
      if (!pedido.fornecedorId) throw new Error("Escolha o fornecedor.");
      const [classe, fornecedorDoc] = await Promise.all([
        camposDaClasse(pedido.classeId, pedido.subclasseId),
        db.collection("cadastros").doc(pedido.fornecedorId).get(),
      ]);
      if (!fornecedorDoc.exists) throw new Error("Fornecedor não encontrado.");
      let pedidoDoc: FirebaseFirestore.DocumentSnapshot | null = null;
      if (pedido.pedidoNumero) {
        const snap = await db.collection("pedidos").where("numero", "==", pedido.pedidoNumero).limit(1).get();
        if (snap.empty) throw new Error(`Pedido ${formatarCodigo(pedido.pedidoNumero)} não encontrado.`);
        pedidoDoc = snap.docs[0];
      }
      const mov = await movRef.get();
      if (!mov.exists) throw new Error("Movimentação não encontrada.");
      if ((mov.data()!.valor ?? 0) >= 0) throw new Error("Só saídas viram gasto. Para entradas, vincule a uma conta a receber.");
      if (mov.data()!.status !== "PENDENTE") throw new Error("Esta movimentação já foi justificada.");
      novoLancamento = {
        id: db.collection("lancamentos").doc().id,
        numeroDocumento: await proximoNumero("financeiro_documento"),
        pedido: pedidoDoc,
        fornecedor: { id: fornecedorDoc.id, nome: fornecedorDoc.data()!.nome ?? "" },
        classe,
      };
    }

    // O arquivo vai antes da transação; se ela falhar, é apagado.
    let comprovante: ComprovanteSalvo | null = null;
    if (arquivo) {
      comprovante = {
        chave: `conciliacao/${movimentacaoId}/${randomUUID()}`,
        tipo: arquivo.type,
        nome: arquivo.name || "cupom",
      };
      await salvarAnexo(comprovante.chave, Buffer.from(await arquivo.arrayBuffer()));
    }

    try {
      await db.runTransaction(async (t) => {
        const mov = await t.get(movRef);
        if (!mov.exists) throw new Error("Movimentação não encontrada.");
        const m = mov.data()!;
        if (m.status !== "PENDENTE") throw new Error("Esta movimentação já foi justificada.");
        const valor = Math.abs(m.valor ?? 0);
        const agora = new Date();

        const justificativa: Omit<JustificativaMovimentacao, "em"> & { em: Date } = {
          modo: pedido.modo,
          texto,
          categoria: "",
          classe: "",
          lancamentoId: "",
          documento: "",
          marcouPago: false,
          usuarioNome,
          em: agora,
        };

        if (pedido.modo === "VINCULADA") {
          const ref = db.collection("lancamentos").doc(pedido.lancamentoId);
          const lanc = await t.get(ref);
          if (!lanc.exists) throw new Error("Conta não encontrada.");
          const l = lanc.data()!;
          if (l.tipo !== ((m.valor ?? 0) < 0 ? "PAGAR" : "RECEBER")) {
            throw new Error((m.valor ?? 0) < 0 ? "Saída só vincula a conta a pagar." : "Entrada só vincula a conta a receber.");
          }
          justificativa.lancamentoId = ref.id;
          justificativa.documento = rotuloDocumento(l.numeroDocumento ?? 0, l.parcela ?? 1, l.totalParcelas ?? 1);
          justificativa.texto =
            texto || `${(m.valor ?? 0) < 0 ? "Pagamento" : "Recebimento"} de ${l.fornecedorNome || l.clienteNome || "conta"}`;
          // A movimentação é o pagamento: dá baixa na conta que ainda estava em aberto.
          justificativa.marcouPago = l.status !== "PAGO";
          if (justificativa.marcouPago || comprovante) {
            t.update(ref, {
              ...(justificativa.marcouPago ? { status: "PAGO", dataPagamento: m.data, banco: "ASAAS", pagoEm: null } : {}),
              // O cupom fica visível também na tela da conta.
              ...(comprovante ? { comprovanteMovimentacaoId: movRef.id } : {}),
              updatedAt: agora,
            });
          }
        }

        if (pedido.modo === "LANCADA" && novoLancamento) {
          const p = novoLancamento.pedido?.data();
          justificativa.categoria = pedido.categoria;
          justificativa.classe = rotuloClasse(novoLancamento.classe.classeNome, novoLancamento.classe.subclasseNome);
          justificativa.lancamentoId = novoLancamento.id;
          justificativa.documento = rotuloDocumento(novoLancamento.numeroDocumento, 1, 1);
          const quem = m.contraparte ? `${m.contraparte}` : rotuloTipoMovimentacao(m.tipo).toUpperCase();
          t.set(db.collection("lancamentos").doc(novoLancamento.id), {
            tipo: "PAGAR",
            numeroDocumento: novoLancamento.numeroDocumento,
            parcela: 1,
            totalParcelas: 1,
            valor,
            valorTotal: valor,
            categoria: pedido.categoria,
            ...novoLancamento.classe,
            formaPagamento: formaPagamentoDaMovimentacao(m.tipo ?? "", m.descricao ?? ""),
            clienteId: p?.cadastroId ?? "",
            clienteNome: p?.cadastroNome ?? "",
            pedidoId: novoLancamento.pedido?.id ?? "",
            pedidoNumero: p?.numero ?? 0,
            fornecedorId: novoLancamento.fornecedor.id,
            fornecedorNome: novoLancamento.fornecedor.nome,
            numeroPedidoFornecedor: "",
            descricao: texto ? `${quem} · ${texto}` : quem,
            vencimento: m.data,
            status: "PAGO",
            dataPagamento: m.data,
            pagoEm: null,
            banco: "ASAAS",
            movimentacaoAsaasId: movRef.id,
            comprovanteMovimentacaoId: comprovante ? movRef.id : "",
            usuarioId: session.user.id,
            usuarioNome,
            createdAt: agora,
            updatedAt: agora,
          });
        }

        t.update(movRef, { status: "JUSTIFICADA", justificativa, comprovante });
      });
    } catch (err) {
      if (comprovante) await excluirArquivoAnexo(comprovante.chave).catch(() => {});
      throw err;
    }

    revalidatePath(LINK_CONCILIACAO);
    revalidatePath("/financeiro");
    if (novoLancamento?.pedido) revalidatePath(`/pedidos/${novoLancamento.pedido.id}`);
  });
}

/**
 * Volta a movimentação para pendente desfazendo o que a justificativa fez:
 * apaga o lançamento criado por ela ou devolve a conta vinculada para pendente.
 */
export async function desfazerJustificativa(movimentacaoId: string) {
  return comResultado(async () => {
    await exigirSessao();
    const movRef = movimentacoesRef().doc(movimentacaoId);
    let chaveComprovante = "";
    await db.runTransaction(async (t) => {
      const mov = await t.get(movRef);
      if (!mov.exists) throw new Error("Movimentação não encontrada.");
      const j = mov.data()!.justificativa as (JustificativaMovimentacao & { em: unknown }) | null;
      if (mov.data()!.status !== "JUSTIFICADA" || !j) return;
      chaveComprovante = (mov.data()!.comprovante as ComprovanteSalvo | null)?.chave ?? "";
      if (j.modo === "AUTOMATICA") throw new Error("Esta movimentação foi justificada pelo sistema.");

      const ref = j.lancamentoId ? db.collection("lancamentos").doc(j.lancamentoId) : null;
      const lanc = ref ? await t.get(ref) : null;
      if (ref && lanc?.exists) {
        if (j.modo === "LANCADA" && lanc.data()!.movimentacaoAsaasId === movRef.id) t.delete(ref);
        if (j.modo === "VINCULADA") {
          const tinhaCupom = lanc.data()!.comprovanteMovimentacaoId === movRef.id;
          if (j.marcouPago || tinhaCupom) {
            t.update(ref, {
              ...(j.marcouPago ? { status: "PENDENTE", dataPagamento: "", banco: "", pagoEm: null } : {}),
              ...(tinhaCupom ? { comprovanteMovimentacaoId: "" } : {}),
              updatedAt: new Date(),
            });
          }
        }
      }
      t.update(movRef, { status: "PENDENTE", justificativa: null, comprovante: null });
    });
    // O cupom era desta justificativa: sai junto.
    if (chaveComprovante) await excluirArquivoAnexo(chaveComprovante).catch(() => {});
    revalidatePath(LINK_CONCILIACAO);
    revalidatePath("/financeiro");
  });
}
