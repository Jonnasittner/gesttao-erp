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
    descricao: data.descricao ?? "",
    usuarioNome: data.usuarioNome ?? null,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? "",
  };
}

/**
 * Valida o formulário e completa com os dados que vêm do banco (nomes e nº do
 * pedido), em vez de confiar no que o navegador mandou. Campos que não se
 * aplicam ao tipo são limpos (ex.: fornecedor num lançamento a receber).
 */
async function montarDocumento(input: LancamentoInput) {
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

  return {
    tipo: dados.tipo,
    clienteId,
    clienteNome: cliente?.data()?.nome ?? "",
    pedidoId,
    pedidoNumero: pedido?.data()?.numero ?? 0,
    fornecedorId,
    fornecedorNome: fornecedor?.data()?.nome ?? "",
    numeroPedidoFornecedor: aPagar ? dados.numeroPedidoFornecedor ?? "" : "",
    formaPagamento: dados.formaPagamento,
    valor: dados.valor,
    vencimento: dados.vencimento,
    status: dados.status,
    dataPagamento: dados.status === "PAGO" ? dados.dataPagamento ?? "" : "",
    descricao: dados.descricao ?? "",
  };
}

export async function listarLancamentos(): Promise<Lancamento[]> {
  await exigirSessao();
  const snap = await lancamentos().orderBy("vencimento", "asc").get();
  return snap.docs.map(toLancamento);
}

export async function buscarLancamento(id: string): Promise<Lancamento | null> {
  await exigirSessao();
  const doc = await lancamentos().doc(id).get();
  return doc.exists ? toLancamento(doc) : null;
}

export async function criarLancamento(input: LancamentoInput) {
  const session = await exigirSessao();

  const documento = await montarDocumento(input);
  const numeroDocumento = await proximoNumero("financeiro_documento");
  const agora = new Date();

  const ref = await lancamentos().add({
    ...documento,
    numeroDocumento,
    usuarioId: session.user.id,
    usuarioNome: session.user.name ?? null,
    createdAt: agora,
    updatedAt: agora,
  });

  revalidatePath("/financeiro");
  return { id: ref.id, numeroDocumento };
}

export async function atualizarLancamento(id: string, input: LancamentoInput) {
  await exigirSessao();

  const documento = await montarDocumento(input);
  await lancamentos().doc(id).update({ ...documento, updatedAt: new Date() });

  revalidatePath("/financeiro");
  revalidatePath(`/financeiro/${id}`);
}

/** Marca como recebido/pago na data informada, ou volta para pendente (data vazia). */
export async function alterarStatusLancamento(id: string, dataPagamento: string | null) {
  await exigirSessao();

  if (dataPagamento !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dataPagamento)) {
    throw new Error("Data de pagamento inválida.");
  }

  await lancamentos()
    .doc(id)
    .update({
      status: dataPagamento ? "PAGO" : "PENDENTE",
      dataPagamento: dataPagamento ?? "",
      updatedAt: new Date(),
    });

  revalidatePath("/financeiro");
}

export async function excluirLancamento(id: string) {
  await exigirSessao();
  await lancamentos().doc(id).delete();
  revalidatePath("/financeiro");
}
