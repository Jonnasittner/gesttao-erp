import { db } from "@/lib/firebase-admin";
import { formatarCodigo } from "@/lib/codigo";
import { hojeISO } from "@/lib/datetime";
import type { AmbienteAsaas, CobrancaAsaas, TipoCobrancaAsaas } from "@/lib/types";

export { TIPOS_COBRANCA_ASAAS, type CobrancaAsaas, type TipoCobrancaAsaas } from "@/lib/types";

// Integração com o Asaas (boleto, Pix e link de pagamento). Cada parcela a
// receber do Financeiro pode virar uma cobrança; o id da cobrança fica no
// próprio lançamento (campo "asaas") e o webhook /api/asaas/webhook marca a
// parcela como recebida quando o cliente paga.
//
// Não é um arquivo "use server": as funções aqui são helpers chamados pelas
// server actions (src/server/asaas.ts) e pela rota do webhook.

export function configAsaas() {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return null;
  // Chaves de produção começam com $aact_prod_; as do sandbox, com $aact_hmlg_.
  const ambiente: AmbienteAsaas = apiKey.startsWith("$aact_prod_") ? "producao" : "sandbox";
  const baseUrl = ambiente === "producao" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
  return { apiKey, ambiente, baseUrl };
}

function exigirConfig() {
  const config = configAsaas();
  if (!config) throw new Error("Asaas não configurado: defina ASAAS_API_KEY no .env.");
  return config;
}

interface ErroAsaas {
  errors?: { code?: string; description?: string }[];
}

export async function asaasFetch<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const { apiKey, baseUrl } = exigirConfig();
  const resp = await fetch(`${baseUrl}${caminho}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      // O Asaas exige User-Agent em contas novas.
      "User-Agent": "Gesttao",
      access_token: apiKey,
      ...init.headers,
    },
    cache: "no-store",
  });

  const texto = await resp.text();
  const json = texto ? JSON.parse(texto) : {};
  if (!resp.ok) {
    const mensagem = (json as ErroAsaas).errors?.map((e) => e.description).filter(Boolean).join(" ");
    throw new Error(mensagem || `Asaas respondeu ${resp.status}.`);
  }
  return json as T;
}

/**
 * Id do cliente no Asaas para o cadastro, criando na primeira cobrança. Fica
 * gravado por ambiente (asaasClientes.sandbox / .producao) porque os clientes
 * do sandbox não existem em produção.
 */
async function garantirClienteAsaas(cadastroId: string): Promise<string> {
  const { ambiente } = exigirConfig();
  const ref = db.collection("cadastros").doc(cadastroId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("Cliente não encontrado.");
  const cadastro = doc.data()!;

  const existente = cadastro.asaasClientes?.[ambiente];
  if (existente) return existente;

  const cpfCnpj = String(cadastro.documento ?? "").replace(/\D/g, "");
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
    throw new Error(`Cadastre o CPF ou CNPJ de ${cadastro.nome} antes de gerar a cobrança.`);
  }
  const telefone = String(cadastro.telefone ?? "").replace(/\D/g, "");

  const cliente = await asaasFetch<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: cadastro.nome,
      cpfCnpj,
      email: cadastro.email || undefined,
      mobilePhone: telefone.length >= 10 ? telefone : undefined,
      address: cadastro.endereco || undefined,
      addressNumber: cadastro.numero || undefined,
      province: cadastro.bairro || undefined,
      externalReference: cadastroId,
      // Quem manda a cobrança para o cliente é a equipe (link/WhatsApp), não o Asaas.
      notificationDisabled: true,
    }),
  });

  await ref.update({ [`asaasClientes.${ambiente}`]: cliente.id });
  return cliente.id;
}

export interface PagamentoAsaas {
  id: string;
  status: string;
  billingType: string;
  value: number;
  dueDate: string;
  invoiceUrl: string;
  bankSlipUrl?: string | null;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  confirmedDate?: string | null;
  deleted?: boolean;
}

/** Status do Asaas que significam dinheiro recebido. */
const STATUS_PAGO = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

function paraCobranca(p: PagamentoAsaas, tipo: TipoCobrancaAsaas, ambiente: AmbienteAsaas): CobrancaAsaas {
  return {
    id: p.id,
    ambiente,
    tipo,
    status: p.status,
    linkPagamento: p.invoiceUrl,
    linkBoleto: p.bankSlipUrl ?? "",
    vencimento: p.dueDate,
    valor: p.value,
  };
}

function lancamentoRef(id: string) {
  return db.collection("lancamentos").doc(id);
}

/** Cria a cobrança no Asaas para uma parcela a receber e grava no lançamento. */
export async function criarCobrancaAsaas(lancamentoId: string, tipo: TipoCobrancaAsaas): Promise<CobrancaAsaas> {
  const { ambiente } = exigirConfig();
  const doc = await lancamentoRef(lancamentoId).get();
  if (!doc.exists) throw new Error("Lançamento não encontrado.");
  const l = doc.data()!;

  if (l.tipo !== "RECEBER") throw new Error("Só lançamentos a receber podem virar cobrança.");
  if (l.status === "PAGO") throw new Error("Esta parcela já foi recebida.");
  if (l.asaas?.id && l.asaas.ambiente === ambiente) throw new Error("Esta parcela já tem uma cobrança no Asaas.");
  if (!l.clienteId) throw new Error("Lançamento sem cliente.");

  const clienteAsaas = await garantirClienteAsaas(l.clienteId);
  // Vencimento no passado não é aceito: cobra para hoje.
  const hoje = hojeISO();
  const vencimento = l.vencimento && l.vencimento > hoje ? l.vencimento : hoje;
  const parcela = (l.totalParcelas ?? 1) > 1 ? ` - parcela ${l.parcela}/${l.totalParcelas}` : "";
  const referencia = l.pedidoNumero ? `Pedido #${formatarCodigo(l.pedidoNumero)}` : `Documento ${l.numeroDocumento}`;

  const pagamento = await asaasFetch<PagamentoAsaas>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: clienteAsaas,
      billingType: tipo,
      value: l.valor,
      dueDate: vencimento,
      description: `${referencia}${parcela}`,
      externalReference: lancamentoId,
    }),
  });

  const cobranca = paraCobranca(pagamento, tipo, ambiente);
  await lancamentoRef(lancamentoId).update({ asaas: cobranca, updatedAt: new Date() });
  return cobranca;
}

/** Pix copia-e-cola + QR Code (base64) e a linha digitável do boleto, quando houver. */
export async function buscarDadosPagamentoAsaas(cobranca: CobrancaAsaas) {
  // Erros aqui não derrubam o balão: o link de pagamento continua valendo.
  // O do Pix é guardado para a tela explicar (ex.: conta sem chave Pix).
  let pixErro = "";
  const [pix, boleto] = await Promise.all([
    cobranca.tipo !== "BOLETO"
      ? asaasFetch<{ encodedImage: string; payload: string }>(`/payments/${cobranca.id}/pixQrCode`).catch(
          (err: Error) => {
            pixErro = err.message;
            return null;
          }
        )
      : null,
    cobranca.tipo !== "PIX"
      ? asaasFetch<{ identificationField: string }>(`/payments/${cobranca.id}/identificationField`).catch(() => null)
      : null,
  ]);
  return {
    pixCopiaECola: pix?.payload ?? "",
    pixQrCodeBase64: pix?.encodedImage ?? "",
    // No link (UNDEFINED) o Pix é opcional; só avisa quando a cobrança é Pix.
    pixErro: cobranca.tipo === "PIX" ? pixErro : "",
    linhaDigitavel: boleto?.identificationField ?? "",
  };
}

/**
 * Lê a cobrança no Asaas e espelha no lançamento: pago no Asaas vira parcela
 * recebida (banco "ASAAS"). Usado pelo webhook e pelo botão "Atualizar".
 */
export async function sincronizarCobrancaAsaas(lancamentoId: string, pagamento?: PagamentoAsaas) {
  const doc = await lancamentoRef(lancamentoId).get();
  if (!doc.exists) return;
  const l = doc.data()!;
  const atual = l.asaas as CobrancaAsaas | undefined;
  if (!atual?.id) return;

  const p = pagamento ?? (await asaasFetch<PagamentoAsaas>(`/payments/${atual.id}`));
  const cobranca = { ...paraCobranca(p, atual.tipo, atual.ambiente), linkBoleto: p.bankSlipUrl ?? atual.linkBoleto };
  const campos: Record<string, unknown> = { asaas: cobranca, updatedAt: new Date() };

  if (STATUS_PAGO.includes(p.status) && l.status !== "PAGO") {
    campos.status = "PAGO";
    campos.dataPagamento = p.clientPaymentDate ?? p.paymentDate ?? p.confirmedDate ?? hojeISO();
    campos.banco = "ASAAS";
  }

  await lancamentoRef(lancamentoId).update(campos);
}

/** Exclui a cobrança no Asaas (se ainda não foi paga) e tira do lançamento. */
export async function cancelarCobrancaAsaas(lancamentoId: string) {
  const doc = await lancamentoRef(lancamentoId).get();
  const cobranca = doc.data()?.asaas as CobrancaAsaas | undefined;
  if (!cobranca?.id) return;
  if (STATUS_PAGO.includes(cobranca.status)) {
    throw new Error("Esta cobrança já foi paga no Asaas e não pode ser cancelada.");
  }

  const config = configAsaas();
  // Cobrança de outro ambiente (ex.: sandbox depois de trocar para produção): só desvincula.
  if (config && config.ambiente === cobranca.ambiente) {
    await asaasFetch(`/payments/${cobranca.id}`, { method: "DELETE" }).catch((err: Error) => {
      if (!/não encontrad|not found/i.test(err.message)) throw err;
    });
  }
  if (doc.exists) await lancamentoRef(lancamentoId).update({ asaas: null, updatedAt: new Date() });
}

/** Leva valor/vencimento editados no Financeiro para a cobrança em aberto. */
export async function atualizarCobrancaAsaas(lancamentoId: string) {
  const doc = await lancamentoRef(lancamentoId).get();
  const l = doc.data();
  const cobranca = l?.asaas as CobrancaAsaas | undefined;
  if (!l || !cobranca?.id || STATUS_PAGO.includes(cobranca.status)) return;
  if (cobranca.valor === l.valor && cobranca.vencimento === l.vencimento) return;

  const hoje = hojeISO();
  const pagamento = await asaasFetch<PagamentoAsaas>(`/payments/${cobranca.id}`, {
    method: "POST",
    // Sem billingType: reenviar "UNDEFINED" (link) faz o Asaas responder 500.
    body: JSON.stringify({
      value: l.valor,
      dueDate: l.vencimento > hoje ? l.vencimento : hoje,
    }),
  });
  await sincronizarCobrancaAsaas(lancamentoId, pagamento);
}

/**
 * Parcela marcada como recebida à mão (dinheiro, transferência...) com
 * cobrança em aberto: avisa o Asaas ("recebida em dinheiro") para ele não
 * continuar cobrando. Voltar para pendente desfaz.
 */
export async function marcarRecebimentoManualAsaas(lancamentoId: string, dataPagamento: string | null) {
  const doc = await lancamentoRef(lancamentoId).get();
  const l = doc.data();
  const cobranca = l?.asaas as CobrancaAsaas | undefined;
  const config = configAsaas();
  if (!l || !cobranca?.id || !config || config.ambiente !== cobranca.ambiente) return;

  if (dataPagamento && !STATUS_PAGO.includes(cobranca.status)) {
    await asaasFetch(`/payments/${cobranca.id}/receiveInCash`, {
      method: "POST",
      body: JSON.stringify({ paymentDate: dataPagamento, value: l.valor, notifyCustomer: false }),
    });
  } else if (!dataPagamento && cobranca.status === "RECEIVED_IN_CASH") {
    await asaasFetch(`/payments/${cobranca.id}/undoReceivedInCash`, { method: "POST" });
  } else {
    return;
  }
  await sincronizarCobrancaAsaas(lancamentoId);
}

/**
 * Gera de uma vez a cobrança de todas as parcelas a receber do documento que
 * ainda não têm (as pendentes). Um de cada vez, na ordem das parcelas; se uma
 * falhar, as anteriores ficam gravadas e o erro sobe.
 */
export async function criarCobrancasDoDocumento(numeroDocumento: number, tipo: TipoCobrancaAsaas) {
  const { ambiente } = exigirConfig();
  const snap = await db.collection("lancamentos").where("numeroDocumento", "==", numeroDocumento).get();
  const pendentes = snap.docs
    .filter((d) => {
      const l = d.data();
      return l.tipo === "RECEBER" && l.status !== "PAGO" && !(l.asaas?.id && l.asaas.ambiente === ambiente);
    })
    .sort((a, b) => (a.data().parcela ?? 1) - (b.data().parcela ?? 1));

  for (const doc of pendentes) await criarCobrancaAsaas(doc.id, tipo);
  return pendentes.length;
}
