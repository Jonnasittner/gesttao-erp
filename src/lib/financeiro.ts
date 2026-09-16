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
