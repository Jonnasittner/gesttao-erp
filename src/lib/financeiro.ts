// Regras do financeiro usadas tanto nas páginas (servidor) quanto nos
// componentes. Não colocar "use client" aqui (ver comentário em rotulos.ts).

import { formatarCodigo } from "@/lib/codigo";
import { formatarMoeda } from "@/lib/moeda";
import type { Lancamento } from "@/lib/types";

/** Rótulo do pedido no seletor: "Pedido 0012 · R$ 1.200,00". */
export function rotuloPedido(numero: number, status: string, total: number): string {
  return `${status === "PEDIDO" ? "Pedido" : "Orçamento"} ${formatarCodigo(numero)} · ${formatarMoeda(total)}`;
}

/** Pendente com vencimento antes de hoje ("AAAA-MM-DD" compara como texto). */
export function estaVencido(lancamento: Lancamento, hoje: string): boolean {
  return lancamento.status === "PENDENTE" && lancamento.vencimento < hoje;
}

export interface ResumoFinanceiro {
  aReceber: number;
  aPagar: number;
  /** Quanto sobra se tudo que está pendente for recebido e pago. */
  saldoPrevisto: number;
  recebido: number;
  pago: number;
  vencidoReceber: number;
  vencidoPagar: number;
  qtdVencidos: number;
}

export function calcularResumo(lista: Lancamento[], hoje: string): ResumoFinanceiro {
  const resumo: ResumoFinanceiro = {
    aReceber: 0,
    aPagar: 0,
    saldoPrevisto: 0,
    recebido: 0,
    pago: 0,
    vencidoReceber: 0,
    vencidoPagar: 0,
    qtdVencidos: 0,
  };

  for (const l of lista) {
    const receber = l.tipo === "RECEBER";
    if (l.status === "PAGO") {
      if (receber) resumo.recebido += l.valor;
      else resumo.pago += l.valor;
      continue;
    }
    if (receber) resumo.aReceber += l.valor;
    else resumo.aPagar += l.valor;

    if (estaVencido(l, hoje)) {
      resumo.qtdVencidos++;
      if (receber) resumo.vencidoReceber += l.valor;
      else resumo.vencidoPagar += l.valor;
    }
  }

  resumo.saldoPrevisto = resumo.aReceber - resumo.aPagar;
  return resumo;
}

// ---------------------------------------------------------------------------
// Parcelas
// ---------------------------------------------------------------------------

/**
 * Divide o total em parcelas com centavos exatos: a sobra da divisão vai para
 * as primeiras parcelas (ex.: R$ 100,00 em 3 → 33,34 + 33,33 + 33,33).
 */
export function dividirValor(total: number, parcelas: number): number[] {
  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / parcelas);
  const sobra = centavos - base * parcelas;
  return Array.from({ length: parcelas }, (_, i) => (base + (i < sobra ? 1 : 0)) / 100);
}

/**
 * Soma meses a uma data "AAAA-MM-DD" mantendo o dia; se o mês não tem esse dia,
 * usa o último (31/01 + 1 mês = 28/02 ou 29/02).
 */
export function somarMeses(dataISO: string, meses: number): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  if (!ano || !mes || !dia) return dataISO;
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

/** "0001 · 2/3" (ou só "0001" quando é parcela única). */
export function rotuloDocumento(numeroDocumento: number, parcela: number, totalParcelas: number): string {
  const documento = formatarCodigo(numeroDocumento);
  return totalParcelas > 1 ? `${documento} · ${parcela}/${totalParcelas}` : documento;
}

/** Id do <datalist> com as sugestões de banco (um por página). */
export const ID_LISTA_BANCOS = "bancos-sugeridos";

/** Sugestões no campo banco (aceita qualquer outro nome digitado). */
export const BANCOS_SUGERIDOS = [
  "BANCO DO BRASIL",
  "BRADESCO",
  "CAIXA",
  "ITAÚ",
  "SANTANDER",
  "NUBANK",
  "INTER",
  "SICREDI",
  "SICOOB",
  "C6 BANK",
  "BTG PACTUAL",
  "BANRISUL",
  "MERCADO PAGO",
  "PAGBANK",
  "CORA",
  "STONE",
  "CAIXA DA EMPRESA (DINHEIRO)",
];
