import { db } from "@/lib/firebase-admin";
import { formatarCodigo } from "@/lib/codigo";
import { hojeISO } from "@/lib/datetime";
import { criarNotificacao } from "@/lib/notificacoes";
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
 * `pagoEm` é o instante do aviso de pagamento (o webhook manda); sem ele,
 * vale a hora em que o sistema percebeu o pagamento.
 */
export async function sincronizarCobrancaAsaas(lancamentoId: string, pagamento?: PagamentoAsaas, pagoEm?: Date) {
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
    campos.pagoEm = pagoEm ?? new Date();
  }

  await lancamentoRef(lancamentoId).update(campos);

  // Pago pelo cliente no Asaas (não a baixa à mão, que vira RECEIVED_IN_CASH): avisa a equipe.
  if (campos.status === "PAGO" && p.status !== "RECEIVED_IN_CASH") {
    const forma = { BOLETO: "Boleto", PIX: "Pix", CREDIT_CARD: "Cartão" }[p.billingType] ?? "Cobrança";
    const parcela = (l.totalParcelas ?? 1) > 1 ? ` (parcela ${l.parcela}/${l.totalParcelas})` : "";
    const valor = p.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    await criarNotificacao({
      chave: `asaas-pago-${p.id}`,
      titulo: `${forma} pago`,
      mensagem: `${l.clienteNome || "Cliente"} pagou ${valor}${parcela}.`,
      link: "/financeiro?tipo=RECEBER&status=pagos",
    }).catch((err) => console.error("[notificacoes] falha ao notificar pagamento", p.id, err));
  }
  return campos.status === "PAGO";
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

/** Intervalo mínimo entre duas conferências automáticas das cobranças em aberto. */
const INTERVALO_CONFERENCIA_MS = 3 * 60_000;

/**
 * Confere no Asaas as cobranças em aberto e dá baixa nas que foram pagas.
 * Rede de segurança para quando o webhook não chega (não configurado, fila
 * pausada no Asaas, ou o sistema rodando em localhost). Roda no máximo a cada
 * 3 minutos para a equipe toda (a marca fica em configuracoes/asaasConferencia);
 * quem chama é a busca de notificações das telas abertas.
 */
export async function conferirCobrancasEmAberto(): Promise<number> {
  const config = configAsaas();
  if (!config) return 0;

  const marca = db.collection("configuracoes").doc("asaasConferencia");
  const podeRodar = await db.runTransaction(async (t) => {
    const ultima = (await t.get(marca)).data()?.ultimaEm?.toDate?.() as Date | undefined;
    if (ultima && Date.now() - ultima.getTime() < INTERVALO_CONFERENCIA_MS) return false;
    t.set(marca, { ultimaEm: new Date() });
    return true;
  });
  if (!podeRodar) return 0;

  const snap = await db.collection("lancamentos").where("status", "==", "PENDENTE").get();
  const abertas = snap.docs.filter((d) => {
    const asaas = d.data().asaas as CobrancaAsaas | null | undefined;
    return d.data().tipo === "RECEBER" && asaas?.id && asaas.ambiente === config.ambiente;
  });

  let baixas = 0;
  for (const doc of abertas) {
    // Uma cobrança com erro (ex.: apagada no Asaas) não impede as outras.
    const pago = await sincronizarCobrancaAsaas(doc.id).catch((err) => {
      console.error("[asaas] falha ao conferir cobrança", doc.id, err);
      return false;
    });
    if (pago) baixas++;
  }
  return baixas;
}

/**
 * Tira a cobrança da parcela sem mexer no Asaas (o boleto continua valendo
 * lá). Para desfazer um vínculo errado; "Cancelar cobrança" é que apaga no Asaas.
 */
export async function desvincularCobrancaAsaas(lancamentoId: string) {
  const doc = await lancamentoRef(lancamentoId).get();
  if (!doc.exists || !doc.data()!.asaas) return;
  await lancamentoRef(lancamentoId).update({ asaas: null, updatedAt: new Date() });
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

// ---------------------------------------------------------------------------
// Cobranças feitas direto no site do Asaas
// ---------------------------------------------------------------------------
// Boletos criados à mão no painel do Asaas não estão ligados a nenhuma parcela.
// A busca lista todas as cobranças da conta que não estão vinculadas, acha o
// cliente do sistema pelo CPF/CNPJ e sugere a parcela de mesmo vencimento (ou
// só de mesmo valor). Na tela dá para trocar a parcela de cada cobrança.
// Nada é vinculado sem a confirmação na tela.

export interface CobrancaEncontradaAsaas {
  id: string;
  status: string;
  billingType: string;
  valor: number;
  vencimento: string;
  link: string;
  descricao: string;
  /** Nome do cliente no Asaas. */
  clienteNome: string;
  /** Cadastro do sistema com o mesmo CPF/CNPJ (null se não houver). */
  cadastroId: string | null;
  /** Parcela sugerida (null se nada bate). */
  sugestaoLancamentoId: string | null;
  /** Sugestão de mesmo vencimento e valor igual (ou centavos de diferença): já vem escolhida. */
  exato: boolean;
}

/** Parcela a receber que pode receber uma cobrança. */
export interface ParcelaLivreAsaas {
  id: string;
  numeroDocumento: number;
  parcela: number;
  totalParcelas: number;
  clienteId: string;
  clienteNome: string;
  valor: number;
  vencimento: string;
  status: string;
  /** Vencimento do boleto ligado hoje por engano à parcela ("" quando não há). */
  trocaVencimento: string;
}

export interface BuscaVinculosAsaas {
  cobrancas: CobrancaEncontradaAsaas[];
  parcelas: ParcelaLivreAsaas[];
  /** Clientes com parcela a receber, mas sem CPF/CNPJ válido no cadastro. */
  semDocumento: string[];
}

interface ListaAsaas<T> {
  data: T[];
  hasMore: boolean;
}

/** Percorre todas as páginas de uma listagem do Asaas (100 por vez). */
async function listarTudoAsaas<T>(caminho: string): Promise<T[]> {
  const itens: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const sep = caminho.includes("?") ? "&" : "?";
    const pagina = await asaasFetch<ListaAsaas<T>>(`${caminho}${sep}limit=100&offset=${offset}`);
    itens.push(...pagina.data);
    if (!pagina.hasMore || pagina.data.length === 0) return itens;
  }
}

/** Cobranças que não vale vincular (estornadas, em disputa...). */
const STATUS_IGNORADOS = ["REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "DUNNING_REQUESTED"];

const centavos = (v: number) => Math.round(v * 100);

/** Diferença aceita no valor quando o vencimento é o mesmo (arredondamento das parcelas). */
const TOLERANCIA_CENTAVOS = 5;

/** Diferença em dias entre duas datas "AAAA-MM-DD". */
function diasEntre(a: string, b: string) {
  return Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86_400_000;
}

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

export async function buscarVinculosAsaas(): Promise<BuscaVinculosAsaas> {
  const { ambiente } = exigirConfig();

  const [snapLancamentos, snapCadastros, clientesAsaas, pagamentos] = await Promise.all([
    db.collection("lancamentos").where("tipo", "==", "RECEBER").get(),
    db.collection("cadastros").get(),
    listarTudoAsaas<{ id: string; name: string; cpfCnpj?: string | null }>("/customers"),
    listarTudoAsaas<PagamentoAsaas & { customer: string; description?: string | null }>("/payments"),
  ]);

  const todos: FirebaseFirestore.DocumentData[] = snapLancamentos.docs.map((d) => ({ ...d.data(), id: d.id }));
  // Vínculo suspeito: parcela em aberto ligada a um boleto de outro vencimento
  // (ex.: par só pelo valor confirmado antes). Entra de novo na busca, junto
  // com o boleto, para poder trocar pelo par certo.
  const suspeita = (l: FirebaseFirestore.DocumentData) =>
    !!l.asaas?.id && l.asaas.ambiente === ambiente && l.status !== "PAGO" && l.asaas.vencimento !== l.vencimento;
  const jaVinculadas = new Set(todos.filter((l) => l.asaas?.id && !suspeita(l)).map((l) => l.asaas.id as string));
  const livres = todos.filter((l) => !(l.asaas?.id && l.asaas.ambiente === ambiente) || suspeita(l));

  // CPF/CNPJ → cadastro do sistema; cliente do Asaas → nome e CPF/CNPJ.
  const cadastroPorDocumento = new Map<string, string>();
  const nomeCadastro = new Map<string, string>();
  for (const doc of snapCadastros.docs) {
    const d = doc.data();
    nomeCadastro.set(doc.id, d.nome ?? "");
    const digitos = soDigitos(d.documento);
    if (digitos.length === 11 || digitos.length === 14) cadastroPorDocumento.set(digitos, doc.id);
  }
  const clientePorId = new Map(clientesAsaas.map((c) => [c.id, c]));

  const cobrancas: CobrancaEncontradaAsaas[] = pagamentos
    .filter((p) => !p.deleted && !jaVinculadas.has(p.id) && !STATUS_IGNORADOS.includes(p.status))
    .map((p) => {
      const cliente = clientePorId.get(p.customer);
      return {
        id: p.id,
        status: p.status,
        billingType: p.billingType,
        valor: p.value,
        vencimento: p.dueDate,
        link: p.invoiceUrl,
        descricao: p.description ?? "",
        clienteNome: cliente?.name ?? "Cliente sem nome",
        cadastroId: cadastroPorDocumento.get(soDigitos(cliente?.cpfCnpj)) ?? null,
        sugestaoLancamentoId: null,
        exato: false,
      };
    });

  // Sugestões, cliente a cliente. 1º mesmo vencimento e valor quase igual (o
  // Asaas joga a sobra da divisão na última parcela e o sistema nas
  // primeiras: 7.682,66 x 7.682,67). 2º só o mesmo valor exato, com
  // vencimento diferente (não vem escolhida). Cada lado entra em um par só.
  const usadas = new Set<string>();
  const pareadas = new Set<string>();
  const ordenadas = [...livres].sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
  for (const exato of [true, false]) {
    for (const l of ordenadas) {
      if (pareadas.has(l.id)) continue;
      // Parcela com vínculo suspeito só troca por um par de mesmo vencimento.
      if (!exato && suspeita(l)) continue;
      const valor = centavos(l.valor ?? 0);
      const cobranca = cobrancas
        .filter((c) => !usadas.has(c.id) && c.cadastroId && c.cadastroId === l.clienteId)
        .filter((c) =>
          exato
            ? c.vencimento === l.vencimento && Math.abs(centavos(c.valor) - valor) <= TOLERANCIA_CENTAVOS
            : centavos(c.valor) === valor
        )
        .sort(
          (a, b) =>
            diasEntre(a.vencimento, l.vencimento) - diasEntre(b.vencimento, l.vencimento) ||
            Math.abs(centavos(a.valor) - valor) - Math.abs(centavos(b.valor) - valor)
        )[0];
      if (!cobranca) continue;
      usadas.add(cobranca.id);
      pareadas.add(l.id);
      cobranca.sugestaoLancamentoId = l.id;
      cobranca.exato = exato;
    }
  }

  // O boleto que segue ligado (por engano) a uma parcela suspeita só aparece
  // se a busca sugeriu outra parcela para ele.
  const presas = new Map(todos.filter(suspeita).map((l) => [l.asaas.id as string, l.id as string]));
  const visiveis = cobrancas.filter((c) => !presas.has(c.id) || (c.sugestaoLancamentoId && c.sugestaoLancamentoId !== presas.get(c.id)));

  const comParcelaEmAberto = new Set(livres.filter((l) => l.status !== "PAGO").map((l) => l.clienteId as string));
  const semDocumento = [...comParcelaEmAberto]
    .filter((id) => id && ![...cadastroPorDocumento.values()].includes(id))
    .map((id) => nomeCadastro.get(id) || "Cliente")
    .sort((a, b) => a.localeCompare(b));

  return {
    // Primeiro as que têm sugestão, depois por cliente e vencimento.
    cobrancas: visiveis.sort(
      (a, b) =>
        Number(!!b.sugestaoLancamentoId) - Number(!!a.sugestaoLancamentoId) ||
        a.clienteNome.localeCompare(b.clienteNome) ||
        a.vencimento.localeCompare(b.vencimento)
    ),
    parcelas: livres
      .map((l) => ({
        id: l.id,
        numeroDocumento: l.numeroDocumento ?? 0,
        parcela: l.parcela ?? 1,
        totalParcelas: l.totalParcelas ?? 1,
        clienteId: l.clienteId ?? "",
        clienteNome: l.clienteNome || nomeCadastro.get(l.clienteId) || "Cliente",
        valor: l.valor ?? 0,
        vencimento: l.vencimento ?? "",
        status: l.status ?? "PENDENTE",
        trocaVencimento: suspeita(l) ? l.asaas.vencimento : "",
      }))
      .sort((a, b) => a.clienteNome.localeCompare(b.clienteNome) || a.vencimento.localeCompare(b.vencimento)),
    semDocumento,
  };
}

/** BOLETO/PIX ficam como estão; cartão e "pergunte ao cliente" viram link de pagamento. */
function tipoDaCobranca(billingType: string): TipoCobrancaAsaas {
  return billingType === "BOLETO" || billingType === "PIX" ? billingType : "UNDEFINED";
}

/**
 * Liga às parcelas as cobranças escolhidas na tela. Relê cada cobrança no
 * Asaas e a parcela passa a ter o valor e o vencimento do boleto (é o que o
 * cliente vai pagar; e, se ficassem diferentes, editar a parcela depois
 * mandaria os dados do sistema para o boleto). Se a cobrança já estiver paga,
 * a parcela vira recebida com a data do Asaas (sem horário e sem notificação:
 * é pagamento antigo). Também guarda o cliente do Asaas no cadastro de mesmo
 * CPF/CNPJ, para as próximas cobranças usarem o mesmo.
 */
export async function vincularCobrancasAsaas(pares: { lancamentoId: string; cobrancaId: string }[]) {
  const { ambiente } = exigirConfig();
  let vinculadas = 0;
  const documentos = new Set<number>();

  // Vínculo trocável: parcela em aberto ligada a boleto de outro vencimento
  // (o mesmo critério da busca). Vínculos certos nunca são mexidos.
  const trocavel = (l: FirebaseFirestore.DocumentData) =>
    l.status !== "PAGO" && l.asaas?.vencimento !== l.vencimento;

  for (const { lancamentoId, cobrancaId } of pares) {
    const ref = lancamentoRef(lancamentoId);
    const l = (await ref.get()).data();
    if (!l || l.tipo !== "RECEBER") continue;
    if (l.asaas?.id === cobrancaId) continue;
    if (l.asaas?.id && l.asaas.ambiente === ambiente && !trocavel(l)) continue;

    // Boleto preso por engano em outra parcela: solta de lá (ela volta a "Cobrar").
    const outra = await db.collection("lancamentos").where("asaas.id", "==", cobrancaId).limit(1).get();
    if (!outra.empty) {
      if (!trocavel(outra.docs[0].data())) continue;
      await outra.docs[0].ref.update({ asaas: null, updatedAt: new Date() });
    }

    const p = await asaasFetch<PagamentoAsaas & { customer: string }>(`/payments/${cobrancaId}`);
    if (p.deleted) continue;

    const campos: Record<string, unknown> = {
      asaas: paraCobranca(p, tipoDaCobranca(p.billingType), ambiente),
      valor: p.value,
      vencimento: p.dueDate,
      updatedAt: new Date(),
    };
    if (STATUS_PAGO.includes(p.status) && l.status !== "PAGO") {
      campos.status = "PAGO";
      campos.dataPagamento = p.clientPaymentDate ?? p.paymentDate ?? p.confirmedDate ?? hojeISO();
      campos.banco = "ASAAS";
      campos.pagoEm = null;
    }
    await ref.update(campos);
    if (l.numeroDocumento) documentos.add(l.numeroDocumento);

    if (l.clienteId && p.customer) {
      const cadastroRef = db.collection("cadastros").doc(l.clienteId);
      const cadastro = (await cadastroRef.get()).data();
      if (cadastro && !cadastro.asaasClientes?.[ambiente]) {
        const cliente = await asaasFetch<{ cpfCnpj?: string | null }>(`/customers/${p.customer}`).catch(() => null);
        if (cliente && soDigitos(cliente.cpfCnpj) === soDigitos(cadastro.documento)) {
          await cadastroRef.update({ [`asaasClientes.${ambiente}`]: p.customer });
        }
      }
    }
    vinculadas++;
  }

  // O valor das parcelas pode ter mudado: refaz o total do documento.
  for (const numero of documentos) {
    const snap = await db.collection("lancamentos").where("numeroDocumento", "==", numero).get();
    const total = Math.round(snap.docs.reduce((soma, d) => soma + (d.data().valor ?? 0), 0) * 100) / 100;
    const lote = db.batch();
    for (const d of snap.docs) lote.update(d.ref, { valorTotal: total });
    await lote.commit();
  }

  return vinculadas;
}
