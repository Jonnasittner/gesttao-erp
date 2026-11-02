import { db } from "@/lib/firebase-admin";
import { asaasFetch, configAsaas, listarTudoAsaas } from "@/lib/asaas";
import { hojeISO } from "@/lib/datetime";
import { formatarMoeda } from "@/lib/moeda";
import { rotuloDocumento } from "@/lib/financeiro";
import { criarNotificacao } from "@/lib/notificacoes";
import { LINK_CONCILIACAO } from "@/lib/conciliacao-aviso";
import type { JustificativaMovimentacao, MovimentacaoAsaas } from "@/lib/types";

// Conciliação: cada linha do extrato da conta Asaas vira um documento em
// "movimentacoesAsaas" e fica pendente até alguém dizer o que ela é. Entradas
// de cobranças geradas pelo sistema e taxas do Asaas se justificam sozinhas;
// o resto (Pix enviado, transferência, Pix recebido sem cobrança...) gera
// notificação e espera na aba Conciliação do Financeiro.
//
// Não é um arquivo "use server": quem chama é a busca de notificações, o
// webhook do Asaas e as actions de src/server/conciliacao.ts.

/** Movimentações antes deste dia ficam de fora (começo da conciliação). */
export const INICIO_CONCILIACAO = "2026-11-01";

/** Intervalo mínimo entre duas leituras automáticas do extrato. */
const INTERVALO_MS = 5 * 60_000;
/** Dias relidos antes do último dia lido (o Asaas pode lançar com data retroativa). */
const DIAS_SOBREPOSTOS = 2;
/** Acima disso, uma notificação só resumindo as novas. */
const MAX_NOTIFICACOES_SEPARADAS = 3;

export { LINK_CONCILIACAO };

export function movimentacoesRef() {
  return db.collection("movimentacoesAsaas");
}

interface TransacaoAsaas {
  id: string;
  value: number;
  balance: number;
  type: string;
  date: string;
  description?: string | null;
  paymentId?: string | null;
  transferId?: string | null;
}

interface TransferenciaAsaas {
  bankAccount?: { ownerName?: string | null } | null;
}

/** Nomes dos tipos mais comuns do extrato; os demais mostram só a descrição do Asaas. */
const ROTULOS_TIPO: Record<string, string> = {
  PAYMENT_RECEIVED: "Cobrança recebida",
  PAYMENT_FEE: "Taxa de cobrança",
  PAYMENT_REVERSAL: "Estorno de cobrança",
  PAYMENT_REFUND_CANCELLED: "Estorno cancelado",
  TRANSFER: "Transferência / Pix enviado",
  TRANSFER_FEE: "Taxa de transferência",
  TRANSFER_REVERSAL: "Transferência devolvida",
  PIX_TRANSACTION_CREDIT: "Pix recebido",
  PIX_TRANSACTION_DEBIT: "Pix enviado",
  PIX_TRANSACTION_CREDIT_REFUND: "Pix recebido devolvido",
  PIX_TRANSACTION_DEBIT_REFUND: "Pix enviado devolvido",
  BILL_PAYMENT: "Pagamento de conta",
  BILL_PAYMENT_FEE: "Taxa de pagamento de conta",
  BILL_PAYMENT_REFUNDED: "Pagamento de conta devolvido",
  INTERNAL_TRANSFER_DEBIT: "Transferência entre contas Asaas",
  INTERNAL_TRANSFER_CREDIT: "Transferência entre contas Asaas",
  CHARGEBACK: "Chargeback",
  CHARGEBACK_REVERSAL: "Chargeback revertido",
  RECEIVABLE_ANTICIPATION_GROSS_CREDIT: "Antecipação",
  RECEIVABLE_ANTICIPATION_FEE: "Taxa de antecipação",
  RECEIVABLE_ANTICIPATION_DEBIT: "Débito de antecipação",
  DEBIT: "Débito",
  CREDIT: "Crédito",
  REVERSAL: "Estorno",
};

export function rotuloTipoMovimentacao(tipo: string): string {
  return ROTULOS_TIPO[tipo] ?? "Movimentação";
}

/** Taxas cobradas pelo próprio Asaas: justificadas sem pedir nada à equipe. */
function ehTaxaAsaas(tipo: string) {
  return tipo.endsWith("_FEE");
}

// Última leitura nesta instância do servidor (evita até ler a marca no Firestore).
let ultimaLeituraLocal = 0;

/**
 * Traz do Asaas as movimentações novas do extrato. Roda no máximo a cada 5
 * minutos para a equipe toda (a busca de notificações chama); `forcar` é para
 * o botão "Atualizar" e o webhook. Devolve quantas ficaram pendentes.
 *
 * Cota de leituras do Firestore: a marca configuracoes/asaasExtrato-<ambiente>
 * guarda o último dia lido e os ids já gravados da janela relida, então
 * movimentação já conhecida não custa leitura nem gravação.
 */
export async function sincronizarExtratoAsaas({ forcar = false } = {}): Promise<number> {
  const config = configAsaas();
  if (!config) return 0;
  if (!forcar && Date.now() - ultimaLeituraLocal < INTERVALO_MS) return 0;
  ultimaLeituraLocal = Date.now();

  const marca = db.collection("configuracoes").doc(`asaasExtrato-${config.ambiente}`);
  const estado = await db.runTransaction(async (t) => {
    const dados = (await t.get(marca)).data();
    const ultima = dados?.ultimaEm?.toDate?.() as Date | undefined;
    if (!forcar && ultima && Date.now() - ultima.getTime() < INTERVALO_MS) return null;
    t.set(marca, { ultimaEm: new Date() }, { merge: true });
    return {
      lidoAte: (dados?.lidoAte as string | undefined) ?? "",
      gravadas: new Set<string>(dados?.gravadas ?? []),
    };
  });
  if (!estado) return 0;

  const hoje = hojeISO();
  const inicio = estado.lidoAte ? maiorData(INICIO_CONCILIACAO, menosDias(estado.lidoAte, DIAS_SOBREPOSTOS)) : INICIO_CONCILIACAO;
  if (inicio > hoje) return 0;
  const itens = await listarTudoAsaas<TransacaoAsaas>(
    `/financialTransactions?startDate=${inicio}&finishDate=${hoje}&order=asc`
  );
  const novas = itens.filter((i) => !estado.gravadas.has(i.id));

  const pendentes: MovimentacaoAsaas[] = [];
  if (novas.length > 0) {
    const [cobrancas, contrapartes] = await Promise.all([lancamentosDasCobrancas(novas), nomesDasTransferencias(novas)]);
    const agora = new Date();

    for (const item of novas) {
      const cobranca = item.paymentId ? cobrancas.get(item.paymentId) : undefined;
      const justificativa = justificativaAutomatica(item, cobranca);
      const mov = {
        ambiente: config.ambiente,
        data: item.date,
        valor: item.value,
        saldo: item.balance ?? 0,
        tipo: item.type,
        descricao: item.description ?? "",
        contraparte: (item.transferId && contrapartes.get(item.transferId)) || cobranca?.clienteNome || "",
        paymentId: item.paymentId ?? "",
        transferId: item.transferId ?? "",
        status: justificativa ? "JUSTIFICADA" : "PENDENTE",
        justificativa: justificativa ? { ...justificativa, em: agora } : null,
        criadaEm: agora,
      };
      const criada = await movimentacoesRef()
        .doc(item.id)
        .create(mov)
        .then(() => true)
        .catch((err: { code?: number }) => {
          // 6 = ALREADY_EXISTS: outra chamada (webhook) gravou primeiro.
          if (err.code !== 6) throw err;
          return false;
        });
      if (criada && !justificativa) {
        pendentes.push({ ...mov, id: item.id, status: "PENDENTE", justificativa: null, criadaEm: agora.toISOString() });
      }
    }
  }

  await notificarPendentes(pendentes);
  // A próxima leitura começa DIAS_SOBREPOSTOS antes de hoje: guarda os ids
  // dessa janela para não regravar o que já está no banco.
  await marca.set({ lidoAte: hoje, gravadas: itens.map((i) => i.id).slice(-1000) }, { merge: true });
  return pendentes.length;
}

type CobrancaDoLancamento = { lancamentoId: string; documento: string; clienteNome: string };

/** Lançamentos com cobrança no Asaas ligados às movimentações (pelo id da cobrança). */
async function lancamentosDasCobrancas(itens: TransacaoAsaas[]) {
  const ids = [...new Set(itens.map((i) => i.paymentId).filter((id): id is string => !!id))];
  const mapa = new Map<string, CobrancaDoLancamento>();
  // "in" aceita até 30 valores por consulta.
  for (let i = 0; i < ids.length; i += 30) {
    const snap = await db.collection("lancamentos").where("asaas.id", "in", ids.slice(i, i + 30)).get();
    for (const doc of snap.docs) {
      const l = doc.data();
      mapa.set(l.asaas.id, {
        lancamentoId: doc.id,
        documento: rotuloDocumento(l.numeroDocumento ?? 0, l.parcela ?? 1, l.totalParcelas ?? 1),
        clienteNome: l.clienteNome ?? "",
      });
    }
  }
  return mapa;
}

/** Nome de quem recebeu cada transferência/Pix enviado (uma consulta ao Asaas por transferência). */
async function nomesDasTransferencias(itens: TransacaoAsaas[]) {
  const ids = [
    ...new Set(itens.filter((i) => i.transferId && !ehTaxaAsaas(i.type)).map((i) => i.transferId as string)),
  ];
  const nomes = await Promise.all(
    ids.map((id) =>
      asaasFetch<TransferenciaAsaas>(`/transfers/${id}`)
        .then((t) => t.bankAccount?.ownerName?.trim() ?? "")
        // Sem o nome a movimentação continua valendo: a descrição do Asaas ajuda.
        .catch(() => "")
    )
  );
  return new Map(ids.map((id, i) => [id, nomes[i]]));
}

function justificativaAutomatica(
  item: TransacaoAsaas,
  cobranca: CobrancaDoLancamento | undefined
): Omit<JustificativaMovimentacao, "em"> | null {
  const base = { categoria: "" as const, marcouPago: false, usuarioNome: null };
  if (cobranca) {
    const assunto = ehTaxaAsaas(item.type) ? "Taxa da cobrança" : rotuloTipoMovimentacao(item.type);
    return {
      ...base,
      modo: "AUTOMATICA",
      texto: `${assunto} do documento ${cobranca.documento}${cobranca.clienteNome ? ` · ${cobranca.clienteNome}` : ""}`,
      lancamentoId: cobranca.lancamentoId,
      documento: cobranca.documento,
    };
  }
  if (ehTaxaAsaas(item.type)) {
    return { ...base, modo: "AUTOMATICA", texto: "Taxa do Asaas", lancamentoId: "", documento: "" };
  }
  return null;
}

/** "Saída de R$ 100,00 · Transferência / Pix enviado para TRANSPORTADORA ABC". */
export function resumoMovimentacao(m: Pick<MovimentacaoAsaas, "valor" | "tipo" | "contraparte" | "descricao">) {
  const sentido = m.valor < 0 ? "Saída" : "Entrada";
  const quem = m.contraparte ? ` · ${m.contraparte}` : m.descricao ? ` · ${m.descricao}` : "";
  return `${sentido} de ${formatarMoeda(Math.abs(m.valor))} · ${rotuloTipoMovimentacao(m.tipo)}${quem}`;
}

async function notificarPendentes(pendentes: MovimentacaoAsaas[]) {
  if (pendentes.length === 0) return;
  const avisos =
    pendentes.length <= MAX_NOTIFICACOES_SEPARADAS
      ? pendentes.map((m) => ({ chave: `asaas-mov-${m.id}`, mensagem: resumoMovimentacao(m) }))
      : [
          {
            chave: `asaas-movs-${pendentes[0].id}`,
            mensagem: `${pendentes.length} movimentações novas no Asaas esperando justificativa.`,
          },
        ];
  for (const aviso of avisos) {
    await criarNotificacao({
      chave: aviso.chave,
      titulo: "Movimentação para conciliar",
      mensagem: aviso.mensagem,
      link: LINK_CONCILIACAO,
    }).catch((err) => console.error("[conciliacao] falha ao notificar", aviso.chave, err));
  }
}

function menosDias(dataISO: string, dias: number) {
  const d = new Date(`${dataISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

function maiorData(a: string, b: string) {
  return a > b ? a : b;
}
