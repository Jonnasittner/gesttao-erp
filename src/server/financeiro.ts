"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { proximoNumero } from "@/lib/contador";
import {
  type Lancamento,
  type LancamentoInput,
  lancamentoSchema,
} from "@/lib/types";

// Cada parcela é um documento em "lancamentos"; as parcelas de um mesmo
// lançamento compartilham o numeroDocumento. Lançamentos antigos (antes do
// parcelamento) não têm os campos de parcela e são lidos como 1/1.

function lancamentos() {
  return db.collection("lancamentos");
}

async function exigirSessao() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");
  return session;
}

function toLancamento(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): Lancamento {
  const data = doc.data()!;
  return {
    id: doc.id,
    numeroDocumento: data.numeroDocumento ?? 0,
    parcela: data.parcela ?? 1,
    totalParcelas: data.totalParcelas ?? 1,
    valorTotal: data.valorTotal ?? data.valor ?? 0,
    tipo: data.tipo,
    clienteId: data.clienteId ?? "",
    clienteNome: data.clienteNome ?? "",
    pedidoId: data.pedidoId ?? "",
    pedidoNumero: data.pedidoNumero ?? 0,
    fornecedorId: data.fornecedorId ?? "",
    fornecedorNome: data.fornecedorNome ?? "",
    numeroPedidoFornecedor: data.numeroPedidoFornecedor ?? "",
    formaPagamento: data.formaPagamento,
    valor: data.valor ?? 0,
    vencimento: data.vencimento ?? "",
    status: data.status ?? "PENDENTE",
    dataPagamento: data.dataPagamento ?? "",
    banco: data.banco ?? "",
    descricao: data.descricao ?? "",
    usuarioNome: data.usuarioNome ?? null,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? "",
  };
}

/**
 * Valida o formulário e monta os dados comuns a todas as parcelas, buscando no
 * banco os nomes e o nº do pedido em vez de confiar no que o navegador mandou.
 * Campos que não se aplicam ao tipo são limpos (ex.: fornecedor a receber).
 */
async function validarEMontar(input: LancamentoInput) {
  const dados = lancamentoSchema.parse(input);
  const aPagar = dados.tipo === "PAGAR";

  const clienteId = dados.clienteId || "";
  const fornecedorId = aPagar ? dados.fornecedorId || "" : "";
  const pedidoId = clienteId ? dados.pedidoId || "" : "";

  const [cliente, fornecedor, pedido] = await Promise.all([
    clienteId ? db.collection("cadastros").doc(clienteId).get() : null,
    fornecedorId ? db.collection("cadastros").doc(fornecedorId).get() : null,
    pedidoId ? db.collection("pedidos").doc(pedidoId).get() : null,
  ]);

  if (clienteId && !cliente?.exists) throw new Error("Cliente não encontrado.");
  if (fornecedorId && !fornecedor?.exists) throw new Error("Fornecedor não encontrado.");
  if (pedidoId) {
    if (!pedido?.exists) throw new Error("Pedido não encontrado.");
    if (pedido.data()?.cadastroId !== clienteId) {
      throw new Error("O pedido escolhido não é desse cliente.");
    }
  }

  const comum = {
    tipo: dados.tipo,
    clienteId,
    clienteNome: cliente?.data()?.nome ?? "",
    pedidoId,
    pedidoNumero: pedido?.data()?.numero ?? 0,
    fornecedorId,
    fornecedorNome: fornecedor?.data()?.nome ?? "",
    numeroPedidoFornecedor: dados.numeroPedidoFornecedor ?? "",
    formaPagamento: dados.formaPagamento,
    descricao: dados.descricao ?? "",
    valorTotal: Math.round(dados.valor * 100) / 100,
    totalParcelas: dados.parcelas.length,
  };

  const parcelas = dados.parcelas.map((p, indice) => ({
    id: p.id || "",
    campos: {
      parcela: indice + 1,
      valor: Math.round(p.valor * 100) / 100,
      vencimento: p.vencimento,
      status: p.status,
      dataPagamento: p.status === "PAGO" ? p.dataPagamento ?? "" : "",
      banco: p.status === "PAGO" ? p.banco ?? "" : "",
    },
  }));

  return { comum, parcelas };
}

async function buscarParcelasDoDocumento(numeroDocumento: number) {
  const snap = await lancamentos().where("numeroDocumento", "==", numeroDocumento).get();
  return snap.docs.sort((a, b) => (a.data().parcela ?? 1) - (b.data().parcela ?? 1));
}

export async function listarLancamentos(): Promise<Lancamento[]> {
  await exigirSessao();
  const snap = await lancamentos().orderBy("vencimento", "asc").get();
  return snap.docs.map(toLancamento);
}

/** Todas as parcelas do documento a que pertence a parcela `id`. */
export async function buscarDocumentoFinanceiro(id: string): Promise<Lancamento[] | null> {
  await exigirSessao();
  const doc = await lancamentos().doc(id).get();
  if (!doc.exists) return null;
  const parcelas = await buscarParcelasDoDocumento(doc.data()!.numeroDocumento);
  return parcelas.map(toLancamento);
}

/** Bancos já usados, para sugerir no campo. */
export async function listarBancosUsados(): Promise<string[]> {
  await exigirSessao();
  const snap = await lancamentos().where("status", "==", "PAGO").get();
  const bancos = new Set(snap.docs.map((d) => (d.data().banco as string | undefined) ?? "").filter(Boolean));
  return [...bancos].sort((a, b) => a.localeCompare(b));
}

export async function criarLancamento(input: LancamentoInput) {
  const session = await exigirSessao();

  const { comum, parcelas } = await validarEMontar(input);
  const numeroDocumento = await proximoNumero("financeiro_documento");
  const agora = new Date();

  const lote = db.batch();
  for (const parcela of parcelas) {
    lote.set(lancamentos().doc(), {
      ...comum,
      ...parcela.campos,
      numeroDocumento,
      usuarioId: session.user.id,
      usuarioNome: session.user.name ?? null,
      createdAt: agora,
      updatedAt: agora,
    });
  }
  await lote.commit();

  revalidatePath("/financeiro");
  return { numeroDocumento, totalParcelas: parcelas.length };
}

/**
 * Atualiza o documento inteiro a partir de qualquer uma das suas parcelas:
 * parcelas com id são atualizadas, sem id são criadas e as que sumiram da
 * simulação são apagadas — exceto se já estavam recebidas/pagas.
 */
export async function atualizarLancamento(id: string, input: LancamentoInput) {
  const session = await exigirSessao();

  const docAtual = await lancamentos().doc(id).get();
  if (!docAtual.exists) throw new Error("Lançamento não encontrado.");
  const numeroDocumento = docAtual.data()!.numeroDocumento;

  const { comum, parcelas } = await validarEMontar(input);
  const existentes = await buscarParcelasDoDocumento(numeroDocumento);
  const idsExistentes = new Set(existentes.map((d) => d.id));

  for (const parcela of parcelas) {
    if (parcela.id && !idsExistentes.has(parcela.id)) {
      throw new Error("Parcela não pertence a este lançamento.");
    }
  }

  const idsMantidos = new Set(parcelas.map((p) => p.id).filter(Boolean));
  const removidas = existentes.filter((d) => !idsMantidos.has(d.id));
  if (removidas.some((d) => d.data().status === "PAGO")) {
    throw new Error("Não é possível remover uma parcela que já foi recebida/paga.");
  }

  const agora = new Date();
  const lote = db.batch();
  for (const parcela of parcelas) {
    if (parcela.id) {
      lote.update(lancamentos().doc(parcela.id), { ...comum, ...parcela.campos, updatedAt: agora });
    } else {
      lote.set(lancamentos().doc(), {
        ...comum,
        ...parcela.campos,
        numeroDocumento,
        usuarioId: session.user.id,
        usuarioNome: session.user.name ?? null,
        createdAt: agora,
        updatedAt: agora,
      });
    }
  }
  for (const doc of removidas) lote.delete(doc.ref);
  await lote.commit();

  revalidatePath("/financeiro");
}

/**
 * Marca uma parcela como recebida/paga na data e banco informados, ou volta
 * para pendente (dataPagamento null).
 */
export async function alterarStatusLancamento(id: string, dataPagamento: string | null, banco = "") {
  await exigirSessao();

  if (dataPagamento !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dataPagamento)) {
    throw new Error("Data de pagamento inválida.");
  }

  await lancamentos()
    .doc(id)
    .update({
      status: dataPagamento ? "PAGO" : "PENDENTE",
      dataPagamento: dataPagamento ?? "",
      banco: dataPagamento ? banco.trim().toUpperCase() : "",
      updatedAt: new Date(),
    });

  revalidatePath("/financeiro");
}

/** Exclui o documento inteiro (todas as parcelas). */
export async function excluirLancamento(id: string) {
  await exigirSessao();

  const doc = await lancamentos().doc(id).get();
  if (!doc.exists) return;

  const parcelas = await buscarParcelasDoDocumento(doc.data()!.numeroDocumento);
  const lote = db.batch();
  for (const parcela of parcelas) lote.delete(parcela.ref);
  await lote.commit();

  revalidatePath("/financeiro");
}
