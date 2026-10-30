"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { comResultado } from "@/lib/resultado";
import { db } from "@/lib/firebase-admin";
import {
  buscarDadosPagamentoAsaas,
  buscarVinculosAsaas,
  cancelarCobrancaAsaas,
  type CobrancaAsaas,
  configAsaas,
  criarCobrancaAsaas,
  criarCobrancasDoDocumento,
  desvincularCobrancaAsaas,
  sincronizarCobrancaAsaas,
  TIPOS_COBRANCA_ASAAS,
  type TipoCobrancaAsaas,
  vincularCobrancasAsaas,
} from "@/lib/asaas";

async function exigirSessao() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");
}

async function revalidarLancamento(lancamentoId: string) {
  const pedidoId = (await db.collection("lancamentos").doc(lancamentoId).get()).data()?.pedidoId;
  revalidatePath("/financeiro");
  if (pedidoId) revalidatePath(`/pedidos/${pedidoId}`);
}

/** Se o Asaas está configurado e em qual ambiente, para a tela saber o que mostrar. */
export async function statusAsaas() {
  const config = configAsaas();
  return { configurado: config !== null, ambiente: config?.ambiente ?? null };
}

export async function gerarCobrancaAsaas(lancamentoId: string, tipo: TipoCobrancaAsaas) {
  return comResultado(async () => {
    await exigirSessao();
    if (!TIPOS_COBRANCA_ASAAS.includes(tipo)) throw new Error("Forma de cobrança inválida.");
    const cobranca = await criarCobrancaAsaas(lancamentoId, tipo);
    await revalidarLancamento(lancamentoId);
    return cobranca;
  });
}

/** Atualiza o status no Asaas e devolve o Pix/boleto para mostrar no balão. */
export async function detalharCobrancaAsaas(lancamentoId: string) {
  return comResultado(async () => {
    await exigirSessao();
    await sincronizarCobrancaAsaas(lancamentoId);
    const cobranca = (await db.collection("lancamentos").doc(lancamentoId).get()).data()?.asaas as
      | CobrancaAsaas
      | null;
    if (!cobranca) throw new Error("Esta parcela não tem cobrança no Asaas.");

    const dados = await buscarDadosPagamentoAsaas(cobranca);
    await revalidarLancamento(lancamentoId);
    return { cobranca, ...dados };
  });
}

export async function excluirCobrancaAsaas(lancamentoId: string) {
  return comResultado(async () => {
    await exigirSessao();
    await cancelarCobrancaAsaas(lancamentoId);
    await revalidarLancamento(lancamentoId);
  });
}

/** Desfaz o vínculo da parcela com a cobrança, mantendo a cobrança no Asaas. */
export async function desvincularCobrancaDoAsaas(lancamentoId: string) {
  return comResultado(async () => {
    await exigirSessao();
    await desvincularCobrancaAsaas(lancamentoId);
    await revalidarLancamento(lancamentoId);
  });
}

/** Procura no Asaas (pelo CPF/CNPJ) cobranças feitas à mão e sugere a parcela de cada uma. */
export async function procurarCobrancasNoAsaas() {
  return comResultado(async () => {
    await exigirSessao();
    return buscarVinculosAsaas();
  });
}

/** Vincula às parcelas as cobranças marcadas na tela. */
export async function vincularCobrancasDoAsaas(pares: { lancamentoId: string; cobrancaId: string }[]) {
  return comResultado(async () => {
    await exigirSessao();
    const vinculadas = await vincularCobrancasAsaas(pares.slice(0, 500));
    revalidatePath("/financeiro");
    revalidatePath("/pedidos", "layout");
    return vinculadas;
  });
}

/** Gera os boletos (ou Pix/link) de todas as parcelas pendentes do documento. */
export async function gerarCobrancasDoDocumento(numeroDocumento: number, tipo: TipoCobrancaAsaas) {
  return comResultado(async () => {
    await exigirSessao();
    if (!TIPOS_COBRANCA_ASAAS.includes(tipo)) throw new Error("Forma de cobrança inválida.");
    try {
      return await criarCobrancasDoDocumento(numeroDocumento, tipo);
    } finally {
      // Mesmo se uma parcela falhar no meio, as já geradas aparecem na tela.
      revalidatePath("/financeiro");
      revalidatePath("/pedidos", "layout");
    }
  });
}
