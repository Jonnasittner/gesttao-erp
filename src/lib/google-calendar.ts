import { db } from "@/lib/firebase-admin";
import { ROTULOS_ETAPA_ATENDIMENTO, ROTULOS_TIPO_INTERACAO } from "@/lib/rotulos";
import { temHorario } from "@/lib/datetime";
import { formatarCodigo } from "@/lib/codigo";
import type { EtapaAtendimento, TipoInteracao } from "@/lib/types";

// Integração com o Google Calendar: uma única conta Google (a da empresa)
// fica conectada em Configurações e recebe os agendamentos de toda a equipe.
// O refresh token fica em configuracoes/googleCalendar no Firestore.
//
// Não é um arquivo "use server": as funções aqui são helpers chamados pelas
// server actions (src/server/*) e pelas rotas /api/google-calendar/*.

export const ESCOPOS_GOOGLE = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

const FUSO = "America/Sao_Paulo";
const API_EVENTOS = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export interface ConexaoGoogle {
  email: string;
  refreshToken: string;
  conectadoEm: string;
  conectadoPor: string | null;
}

export function credenciaisGoogle() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function conexaoRef() {
  return db.collection("configuracoes").doc("googleCalendar");
}

export async function buscarConexaoGoogle(): Promise<ConexaoGoogle | null> {
  const doc = await conexaoRef().get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  if (!data.refreshToken) return null;
  return {
    email: data.email ?? "",
    refreshToken: data.refreshToken,
    conectadoEm: data.conectadoEm?.toDate?.().toISOString() ?? "",
    conectadoPor: data.conectadoPor ?? null,
  };
}

// Access token dura ~1h; guardado em memória para não renovar a cada chamada.
let tokenEmCache: { refreshToken: string; accessToken: string; expiraEm: number } | null = null;

async function obterAccessToken(conexao: ConexaoGoogle): Promise<string> {
  if (
    tokenEmCache &&
    tokenEmCache.refreshToken === conexao.refreshToken &&
    tokenEmCache.expiraEm > Date.now() + 60_000
  ) {
    return tokenEmCache.accessToken;
  }

  const credenciais = credenciaisGoogle();
  if (!credenciais) throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados");

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credenciais.clientId,
      client_secret: credenciais.clientSecret,
      refresh_token: conexao.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) {
    throw new Error(`Falha ao renovar token do Google (${resp.status}): ${await resp.text()}`);
  }

  const json = (await resp.json()) as { access_token: string; expires_in: number };
  tokenEmCache = {
    refreshToken: conexao.refreshToken,
    accessToken: json.access_token,
    expiraEm: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

export function limparTokenEmCache() {
  tokenEmCache = null;
}

/**
 * ID do evento no Google derivado do ID da interação, para que criar,
 * atualizar e excluir não precisem guardar nada de volta no Firestore. O
 * Google só aceita [a-v0-9] em IDs próprios — o hex do ID do Firestore cabe.
 */
function idEventoGoogle(interacaoId: string): string {
  return `gst${Buffer.from(interacaoId).toString("hex")}`;
}

/** Soma dias/horas a "AAAA-MM-DD" ou "AAAA-MM-DDTHH:mm:ss" sem passar por fuso. */
function somar(valor: string, ms: number, tamanho: number): string {
  const base = valor.length === 10 ? `${valor}T00:00:00Z` : `${valor}Z`;
  return new Date(new Date(base).getTime() + ms).toISOString().slice(0, tamanho);
}

export interface AgendamentoParaGoogle {
  interacaoId: string;
  cadastroId: string;
  nomeCliente: string;
  tipo: TipoInteracao;
  etapa: EtapaAtendimento;
  descricao: string;
  valorEstimado: number;
  usuarioNome: string | null;
  /** "AAAA-MM-DD" (dia inteiro) ou "AAAA-MM-DDTHH:mm". */
  dataReagendamento: string;
}

function montarEvento(ag: AgendamentoParaGoogle) {
  const linhas = [
    ag.descricao,
    "",
    `Etapa: ${ROTULOS_ETAPA_ATENDIMENTO[ag.etapa] ?? ag.etapa}`,
  ];
  if (ag.valorEstimado > 0) {
    linhas.push(
      `Valor estimado: R$ ${ag.valorEstimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    );
  }
  if (ag.usuarioNome) linhas.push(`Registrado por: ${ag.usuarioNome}`);
  // O Netlify define URL com o endereço público do site.
  if (process.env.URL) linhas.push("", `${process.env.URL}/cadastros/${ag.cadastroId}`);

  const valor = ag.dataReagendamento;
  const periodo = temHorario(valor)
    ? {
        start: { dateTime: `${valor}:00`, timeZone: FUSO },
        end: { dateTime: somar(`${valor}:00`, 60 * 60_000, 19), timeZone: FUSO },
      }
    : {
        start: { date: valor },
        end: { date: somar(valor, 24 * 60 * 60_000, 10) },
      };

  return {
    id: idEventoGoogle(ag.interacaoId),
    status: "confirmed",
    summary: `${ROTULOS_TIPO_INTERACAO[ag.tipo] ?? ag.tipo} · ${ag.nomeCliente}`,
    description: linhas.join("\n"),
    ...periodo,
  };
}

/**
 * fetch que espera e tenta de novo quando o Google limita a taxa de gravação
 * (403 rateLimitExceeded / 429) — comum em contas novas com vários envios seguidos.
 */
async function fetchComRetentativa(url: string, init: RequestInit): Promise<Response> {
  for (let tentativa = 0; ; tentativa++) {
    const resp = await fetch(url, init);
    const limitado =
      resp.status === 429 ||
      (resp.status === 403 && /rateLimitExceeded|userRateLimitExceeded/.test(await resp.clone().text()));
    if (!limitado || tentativa >= 4) return resp;
    await new Promise((r) => setTimeout(r, 1000 * 2 ** tentativa + Math.random() * 500));
  }
}

/** Cria ou atualiza um evento pelo seu ID. Sem conta conectada, não faz nada. */
async function gravarEvento(evento: { id: string } & Record<string, unknown>) {
  const conexao = await buscarConexaoGoogle();
  if (!conexao) return;

  const token = await obterAccessToken(conexao);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // PUT primeiro: também "ressuscita" um evento excluído antes (status
  // confirmed), caso em que um POST com o mesmo ID daria 409.
  let resp = await fetchComRetentativa(`${API_EVENTOS}/${evento.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(evento),
  });
  if (resp.status === 404) {
    resp = await fetchComRetentativa(API_EVENTOS, { method: "POST", headers, body: JSON.stringify(evento) });
  }
  if (!resp.ok) {
    throw new Error(`Google Calendar respondeu ${resp.status}: ${await resp.text()}`);
  }
}

/** Remove um evento pelo seu ID (ignora se já não existir). */
async function apagarEvento(id: string) {
  const conexao = await buscarConexaoGoogle();
  if (!conexao) return;

  const token = await obterAccessToken(conexao);
  const resp = await fetchComRetentativa(`${API_EVENTOS}/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok && resp.status !== 404 && resp.status !== 410) {
    throw new Error(`Google Calendar respondeu ${resp.status}: ${await resp.text()}`);
  }
}

/** Cria ou atualiza o evento do agendamento. */
export async function salvarEventoGoogle(ag: AgendamentoParaGoogle) {
  await gravarEvento(montarEvento(ag));
}

/** Remove o evento do agendamento. */
export async function excluirEventoGoogle(interacaoId: string) {
  await apagarEvento(idEventoGoogle(interacaoId));
}

// --- Leitura ----------------------------------------------------------------

export interface EventoGoogle {
  id: string;
  titulo: string;
  /** "AAAA-MM-DD" do dia em que o evento começa (horário de Brasília). */
  dia: string;
  /** "HH:mm" ou null para dia inteiro. */
  hora: string | null;
  origem: "AGENDAMENTO" | "ORCAMENTO" | "PEDIDO" | "GOOGLE";
  /** Para onde o "Abrir" do balão leva: página do sistema ou o evento no Google. */
  link: string;
  /** Texto do agendamento, ou a descrição do evento criado no Google. */
  descricao: string;
  /** Total do orçamento/pedido, ou valor estimado do agendamento. */
  valor: number | null;
  /** Itens orçados (só orçamentos e pedidos). */
  itens: ItemEventoGoogle[];
  /** Cliente do agendamento/orçamento (null em eventos criados no Google). */
  cadastroId: string | null;
  /** Código do orçamento/pedido, ex.: "0123" (null nos demais). */
  codigo: string | null;
}

export interface ItemEventoGoogle {
  nome: string;
  quantidade: number;
  comprimento: number;
  largura: number;
  precoUnitario: number;
}

const PARTES_SP = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function diaEHoraEmSP(iso: string) {
  const p = Object.fromEntries(PARTES_SP.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

/** Desfaz o idEvento*(): tira o prefixo de 3 letras e volta o hex para o ID do Firestore. */
function idFirestoreDoEvento(id: string): string {
  return Buffer.from(id.slice(3), "hex").toString();
}

interface EventoApiGoogle {
  id: string;
  summary?: string;
  htmlLink: string;
  start: { date?: string; dateTime?: string };
  description?: string;
}

/** Eventos da agenda conectada entre timeMin e timeMax (ISO). Sem conexão, lista vazia. */
export async function listarEventosGoogle(timeMin: string, timeMax: string): Promise<EventoGoogle[]> {
  const conexao = await buscarConexaoGoogle();
  if (!conexao) return [];
  const token = await obterAccessToken(conexao);

  const itens: EventoApiGoogle[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500",
      timeZone: FUSO,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const resp = await fetchComRetentativa(`${API_EVENTOS}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error(`Google Calendar respondeu ${resp.status}: ${await resp.text()}`);
    const json = (await resp.json()) as { items?: EventoApiGoogle[]; nextPageToken?: string };
    itens.push(...(json.items ?? []));
    pageToken = json.nextPageToken;
  } while (pageToken);

  // Detalhes do balão vêm do Firestore: a interação (texto, valor, cliente)
  // e o pedido (total e itens).
  const buscar = async (colecao: string, prefixos: string[]) => {
    const ids = [...new Set(itens.filter((e) => prefixos.includes(e.id.slice(0, 3))).map((e) => idFirestoreDoEvento(e.id)))];
    const mapa = new Map<string, FirebaseFirestore.DocumentData>();
    if (ids.length === 0) return mapa;
    const docs = await db.getAll(...ids.map((id) => db.collection(colecao).doc(id)));
    for (const doc of docs) if (doc.exists) mapa.set(doc.id, doc.data()!);
    return mapa;
  };
  const [interacoes, pedidos] = await Promise.all([
    buscar("interacoes", ["gst"]),
    buscar("pedidos", ["gso", "gsp"]),
  ]);

  return itens.map((e) => {
    const { dia, hora } = e.start.date
      ? { dia: e.start.date, hora: null }
      : diaEHoraEmSP(e.start.dateTime!);
    const prefixo = e.id.slice(0, 3);
    const idSistema = idFirestoreDoEvento(e.id);

    const base = { id: e.id, titulo: e.summary ?? "(sem título)", dia, hora };

    if (prefixo === "gst") {
      const interacao = interacoes.get(idSistema);
      return {
        ...base,
        origem: "AGENDAMENTO" as const,
        link: interacao ? `/cadastros/${interacao.cadastroId}` : e.htmlLink,
        descricao: interacao?.descricao ?? "",
        valor: interacao?.valorEstimado > 0 ? interacao!.valorEstimado : null,
        itens: [],
        cadastroId: interacao?.cadastroId ?? null,
        codigo: null,
      };
    }

    if (prefixo === "gso" || prefixo === "gsp") {
      const pedido = pedidos.get(idSistema);
      return {
        ...base,
        origem: prefixo === "gso" ? ("ORCAMENTO" as const) : ("PEDIDO" as const),
        link: `/pedidos/${idSistema}`,
        descricao: "",
        valor: pedido?.total ?? null,
        itens: ((pedido?.itens ?? []) as FirebaseFirestore.DocumentData[]).map((i) => ({
          nome: i.produtoNome ?? "",
          quantidade: i.quantidade ?? 0,
          comprimento: i.comprimento ?? 0,
          largura: i.largura ?? 0,
          precoUnitario: i.precoUnitario ?? 0,
        })),
        cadastroId: pedido?.cadastroId ?? null,
        codigo: pedido ? formatarCodigo(pedido.numero) : null,
      };
    }

    return { ...base, origem: "GOOGLE" as const, link: e.htmlLink, descricao: e.description ?? "", valor: null, itens: [], cadastroId: null, codigo: null };
  });
}

// --- Orçamentos e pedidos ---------------------------------------------------
// Cada orçamento vira um evento no dia em que foi feito; quando é
// transformado em pedido, ganha um segundo evento ("Ped #...") no dia
// da conversão. Cores do Google: 5 = amarelo, 10 = verde.

const COR_ORCAMENTO = "5";
const COR_PEDIDO = "10";

function idEventoOrcamento(pedidoId: string) {
  return `gso${Buffer.from(pedidoId).toString("hex")}`;
}

function idEventoPedidoFechado(pedidoId: string) {
  return `gsp${Buffer.from(pedidoId).toString("hex")}`;
}

function paraData(valor: unknown): Date | null {
  if (valor && typeof (valor as { toDate?: unknown }).toDate === "function") {
    return (valor as { toDate: () => Date }).toDate();
  }
  if (valor instanceof Date) return valor;
  return null;
}

/** Evento de 30 min começando no instante dado (o Google converte para o fuso). */
function periodoNoInstante(instante: Date) {
  return {
    start: { dateTime: instante.toISOString(), timeZone: FUSO },
    end: { dateTime: new Date(instante.getTime() + 30 * 60_000).toISOString(), timeZone: FUSO },
  };
}

type DadosPedido = FirebaseFirestore.DocumentData;

async function gravarEventosPedido(pedidoId: string, data: DadosPedido) {
  const codigo = formatarCodigo(data.numero);
  const total = `R$ ${(data.total ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const link = process.env.URL ? ["", `${process.env.URL}/pedidos/${pedidoId}`] : [];
  const criadoEm = paraData(data.createdAt);

  if (criadoEm) {
    await gravarEvento({
      id: idEventoOrcamento(pedidoId),
      status: "confirmed",
      summary: `Orç #${codigo} · ${data.cadastroNome}`,
      description: [`Orçamento de ${total}`, ...link].join("\n"),
      colorId: COR_ORCAMENTO,
      ...periodoNoInstante(criadoEm),
    });
  }

  if (data.status === "PEDIDO") {
    // Pedidos convertidos antes de existir convertidoEm usam a última alteração.
    const fechadoEm = paraData(data.convertidoEm) ?? paraData(data.updatedAt) ?? criadoEm;
    if (fechadoEm) {
      await gravarEvento({
        id: idEventoPedidoFechado(pedidoId),
        status: "confirmed",
        summary: `Ped #${codigo} · ${data.cadastroNome}`,
        description: [`Pedido de ${total}`, ...link].join("\n"),
        colorId: COR_PEDIDO,
        ...periodoNoInstante(fechadoEm),
      });
    }
  } else {
    await apagarEvento(idEventoPedidoFechado(pedidoId));
  }
}

/** Espelha o orçamento/pedido no Google; erros só vão para o log. */
export async function sincronizarPedidoComGoogle(pedidoId: string) {
  try {
    const doc = await db.collection("pedidos").doc(pedidoId).get();
    if (!doc.exists) {
      await excluirPedidoDoGoogle(pedidoId);
      return;
    }
    await gravarEventosPedido(pedidoId, doc.data()!);
  } catch (err) {
    console.error("[google-calendar] falha ao sincronizar pedido", pedidoId, err);
  }
}

/** Remove os eventos do orçamento/pedido excluído; erros só vão para o log. */
export async function excluirPedidoDoGoogle(pedidoId: string) {
  try {
    await apagarEvento(idEventoOrcamento(pedidoId));
    await apagarEvento(idEventoPedidoFechado(pedidoId));
  } catch (err) {
    console.error("[google-calendar] falha ao excluir pedido", pedidoId, err);
  }
}

/**
 * Envia ao Google todos os agendamentos com data e todos os
 * orçamentos/pedidos (os eventos são
 * idempotentes, então rodar de novo só atualiza). Chamado sozinho logo após
 * conectar a conta, para a agenda já nascer com tudo o que existe.
 */
export async function enviarTodosAgendamentosParaGoogle(): Promise<{ enviados: number; falhas: number }> {
  const [interacoes, cadastros, pedidos] = await Promise.all([
    db.collection("interacoes").where("dataReagendamento", "!=", null).get(),
    db.collection("cadastros").get(),
    db.collection("pedidos").get(),
  ]);
  const nomePorCadastro = new Map(cadastros.docs.map((d) => [d.id, d.data().nome as string]));

  let enviados = 0;
  let falhas = 0;
  // Um de cada vez: o Google limita gravações seguidas na mesma agenda
  // (envios em paralelo levavam a "Rate Limit Exceeded" já com 5 por vez).
  const docs = interacoes.docs.filter((d) => d.data().dataReagendamento);
  for (const doc of docs) {
    const data = doc.data();
    try {
      await salvarEventoGoogle({
        interacaoId: doc.id,
        cadastroId: data.cadastroId,
        nomeCliente: nomePorCadastro.get(data.cadastroId) ?? "Cliente",
        tipo: data.tipo,
        etapa: data.etapa ?? "NOVO",
        descricao: data.descricao ?? "",
        valorEstimado: data.valorEstimado ?? 0,
        usuarioNome: data.usuarioNome ?? null,
        dataReagendamento: data.dataReagendamento,
      });
      enviados++;
    } catch (err) {
      falhas++;
      console.error("[google-calendar] falha no envio em massa", doc.id, err);
    }
  }

  for (const doc of pedidos.docs) {
    try {
      await gravarEventosPedido(doc.id, doc.data());
      enviados++;
    } catch (err) {
      falhas++;
      console.error("[google-calendar] falha no envio em massa (pedido)", doc.id, err);
    }
  }

  console.info(`[google-calendar] envio em massa: ${enviados} enviados, ${falhas} falhas`);
  return { enviados, falhas };
}

/**
 * Lê a interação no Firestore e espelha no Google: com data de agendamento
 * vira evento, sem data o evento é removido. Erros só vão para o log — uma
 * falha no Google nunca deve impedir de salvar o agendamento no sistema.
 */
export async function sincronizarInteracaoComGoogle(interacaoId: string) {
  try {
    const doc = await db.collection("interacoes").doc(interacaoId).get();
    const data = doc.data();
    if (!data || !data.dataReagendamento) {
      await excluirEventoGoogle(interacaoId);
      return;
    }

    const cadastro = await db.collection("cadastros").doc(data.cadastroId).get();
    await salvarEventoGoogle({
      interacaoId,
      cadastroId: data.cadastroId,
      nomeCliente: cadastro.data()?.nome ?? "Cliente",
      tipo: data.tipo,
      etapa: data.etapa ?? "NOVO",
      descricao: data.descricao ?? "",
      valorEstimado: data.valorEstimado ?? 0,
      usuarioNome: data.usuarioNome ?? null,
      dataReagendamento: data.dataReagendamento,
    });
  } catch (err) {
    console.error("[google-calendar] falha ao sincronizar interação", interacaoId, err);
  }
}
