import Link from "next/link";
import { AlertTriangleIcon, ArrowDownCircle, ArrowUpCircle, CheckCircle2Icon, ClockIcon, PlusIcon, TruckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LancamentoAcoes } from "@/components/financeiro/lancamento-acoes";
import { SituacaoBadge } from "@/components/financeiro/situacao-badge";
import { CustoSugeridoBotao } from "@/components/pedidos/custo-sugerido-botao";
import {
  ID_LISTA_BANCOS,
  calcularMargemPedido,
  compararCustoSugerido,
  estaVencido,
  rotuloDocumento,
} from "@/lib/financeiro";
import { formatarMoeda } from "@/lib/moeda";
import { formatarDataISO, hojeISO } from "@/lib/datetime";
import { ROTULOS_CATEGORIA_CUSTO, ROTULOS_FORMA_PAGAMENTO } from "@/lib/rotulos";
import { CATEGORIA_CUSTO, type Lancamento, type Pedido } from "@/lib/types";

interface FinanceiroPedidoProps {
  pedido: Pedido;
  lancamentos: Lancamento[];
  sugestoesBanco: string[];
  /** Custo pela tabela dos produtos (custo por m²), sugerido ao informar o custo sugerido. */
  custoCalculado: number;
}

/**
 * Visão financeira centralizada do pedido: o que o cliente paga, o que foi
 * gasto (fornecedor, frete...) e a margem que sobra.
 */
export function FinanceiroPedido({ pedido, lancamentos, sugestoesBanco, custoCalculado }: FinanceiroPedidoProps) {
  const hoje = hojeISO();
  const voltarPara = `/pedidos/${pedido.id}`;
  const recebimentos = lancamentos.filter((l) => l.tipo === "RECEBER");
  const custos = lancamentos.filter((l) => l.tipo === "PAGAR");
  const margem = calcularMargemPedido(pedido.total, lancamentos);
  const isPedido = pedido.status === "PEDIDO";

  const linkNovo = (tipo: "RECEBER" | "PAGAR", categoria?: string) =>
    `/financeiro/novo?pedido=${pedido.id}&tipo=${tipo}${categoria ? `&categoria=${categoria}` : ""}`;

  const botaoSugerido = (
    <CustoSugeridoBotao pedidoId={pedido.id} custoSugerido={pedido.custoSugerido} custoCalculado={custoCalculado} />
  );

  if (!isPedido && lancamentos.length === 0) {
    return (
      <section className="superficie flex flex-col gap-3 border-dashed p-5 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium text-foreground">Financeiro do pedido</h2>
          {botaoSugerido}
        </div>
        <p>
          Ao transformar este orçamento em pedido, você informa a condição de pagamento. Depois, aqui mesmo, lança
          os custos (fornecedor, frete...) e acompanha a margem.
        </p>
        {pedido.custoSugerido !== null && (
          <PainelCustoSugerido comparacao={compararCustoSugerido(pedido.custoSugerido, pedido.total, [])} />
        )}
      </section>
    );
  }

  const corMargem =
    margem.margem < 0
      ? "text-rose-700 dark:text-rose-400"
      : "text-emerald-700 dark:text-emerald-400";

  return (
    <section className="superficie flex flex-col gap-6 p-5">
      {/* Sugestões do campo banco na janela "Recebido/Pago" */}
      <datalist id={ID_LISTA_BANCOS}>
        {sugestoesBanco.map((banco) => (
          <option key={banco} value={banco} />
        ))}
      </datalist>

      <h2 className="text-lg font-semibold">Financeiro do pedido</h2>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo
          titulo="Venda"
          valor={formatarMoeda(margem.receita)}
          detalhe={
            margem.receitaDoFinanceiro
              ? `Recebido: ${formatarMoeda(margem.recebido)}`
              : "Valor do pedido (sem recebimento lançado)"
          }
        />
        <Resumo
          titulo="Custos"
          valor={formatarMoeda(margem.custos)}
          classeValor="text-rose-700 dark:text-rose-400"
          detalhe={custos.length ? `Pago: ${formatarMoeda(margem.pago)}` : "Nenhum custo lançado"}
        />
        <Resumo
          titulo="Margem"
          valor={formatarMoeda(margem.margem)}
          classeValor={corMargem}
          detalhe={
            margem.margemPercentual === null
              ? "—"
              : `${margem.margemPercentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da venda`
          }
          destaque
        />
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Custos por tipo</span>
          {custos.length === 0 ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : (
            <ul className="flex flex-col gap-0.5 text-xs sm:text-sm">
              {CATEGORIA_CUSTO.filter((c) => margem.custosPorCategoria[c]).map((c) => (
                <li key={c} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{ROTULOS_CATEGORIA_CUSTO[c].replace(" (fornecedor)", "")}</span>
                  <span className="font-medium tabular-nums">{formatarMoeda(margem.custosPorCategoria[c]!)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recebimentos */}
      <Bloco
        icone={<ArrowDownCircle className="size-4 text-emerald-600" />}
        titulo="Recebimentos do cliente"
        acoes={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link href={linkNovo("RECEBER")}>
                <PlusIcon /> Lançar recebimento
              </Link>
            }
          />
        }
        vazio="Nenhum recebimento lançado para este pedido."
        itens={recebimentos}
        hoje={hoje}
        voltarPara={voltarPara}
      />

      {/* Custos */}
      <Bloco
        icone={<ArrowUpCircle className="size-4 text-rose-600" />}
        titulo="Custos do pedido"
        acoes={
          <div className="flex flex-wrap gap-2">
            {botaoSugerido}
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <Link href={linkNovo("PAGAR", "FRETE")}>
                  <TruckIcon /> Frete
                </Link>
              }
            />
            <Button
              size="sm"
              nativeButton={false}
              render={
                <Link href={linkNovo("PAGAR")}>
                  <PlusIcon /> Adicionar custo
                </Link>
              }
            />
          </div>
        }
        vazio="Nenhum custo lançado. Adicione o que foi pago ao fornecedor, o frete e outros gastos."
        itens={custos}
        hoje={hoje}
        voltarPara={voltarPara}
        antesDaLista={
          pedido.custoSugerido !== null ? (
            <PainelCustoSugerido
              comparacao={compararCustoSugerido(pedido.custoSugerido, margem.receita, lancamentos)}
            />
          ) : undefined
        }
      />
    </section>
  );
}

function Resumo({
  titulo,
  valor,
  detalhe,
  classeValor = "text-foreground",
  destaque = false,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
  classeValor?: string;
  destaque?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 rounded-xl border p-4 ${destaque ? "bg-muted/40 ring-1 ring-primary/15" : "bg-card"}`}>
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{titulo}</span>
      <span className={`text-lg font-bold tabular-nums sm:text-2xl ${classeValor}`}>{valor}</span>
      <span className="text-[11px] text-muted-foreground sm:text-xs">{detalhe}</span>
    </div>
  );
}

function Bloco({
  icone,
  titulo,
  acoes,
  vazio,
  itens,
  hoje,
  voltarPara,
  antesDaLista,
}: {
  icone: React.ReactNode;
  titulo: string;
  acoes: React.ReactNode;
  vazio: string;
  itens: Lancamento[];
  hoje: string;
  voltarPara: string;
  antesDaLista?: React.ReactNode;
}) {
  const total = itens.reduce((soma, l) => soma + l.valor, 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          {icone} {titulo}
          {itens.length > 0 && (
            <span className="font-normal text-muted-foreground">· {formatarMoeda(total)}</span>
          )}
        </h3>
        {acoes}
      </div>

      {antesDaLista}

      {itens.length === 0 ? (
        <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {itens.map((l) => (
            <LinhaLancamento key={l.id} lancamento={l} hoje={hoje} voltarPara={voltarPara} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LinhaLancamento({
  lancamento: l,
  hoje,
  voltarPara,
}: {
  lancamento: Lancamento;
  hoje: string;
  voltarPara: string;
}) {
  const documento = rotuloDocumento(l.numeroDocumento, l.parcela, l.totalParcelas);
  const aReceber = l.tipo === "RECEBER";
  const pago = l.status === "PAGO";

  const descricao = aReceber
    ? ROTULOS_FORMA_PAGAMENTO[l.formaPagamento]
    : [
        l.categoria ? ROTULOS_CATEGORIA_CUSTO[l.categoria].replace(" (fornecedor)", "") : "",
        l.fornecedorNome,
        l.numeroPedidoFornecedor ? `Ped. forn. ${l.numeroPedidoFornecedor}` : "",
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <li className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-mono text-xs text-muted-foreground">{documento}</span>{" "}
          <span className="font-medium">{descricao}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {pago ? (
            <>
              {aReceber ? "Recebido" : "Pago"} em {formatarDataISO(l.dataPagamento)}
              {l.banco ? ` · ${l.banco}` : ""}
            </>
          ) : (
            <span className={estaVencido(l, hoje) ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
              Vence {formatarDataISO(l.vencimento)}
            </span>
          )}
          {aReceber ? "" : ` · ${ROTULOS_FORMA_PAGAMENTO[l.formaPagamento]}`}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span
          className={`font-semibold tabular-nums ${aReceber ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}
        >
          {aReceber ? "" : "− "}
          {formatarMoeda(l.valor)}
        </span>
        <SituacaoBadge lancamento={l} hoje={hoje} />
        <LancamentoAcoes lancamento={l} documento={documento} voltarPara={voltarPara} />
      </div>
    </li>
  );
}

/** Custo sugerido × valor da fábrica (mercadoria lançada) e a margem prevista. */
function PainelCustoSugerido({ comparacao: c }: { comparacao: ReturnType<typeof compararCustoSugerido> }) {
  const estilos = {
    AGUARDANDO: {
      caixa: "border-muted bg-muted/40",
      icone: <ClockIcon className="size-4 text-muted-foreground" />,
      texto: "Aguardando o valor da fábrica (nenhum custo de mercadoria lançado).",
    },
    IGUAL: {
      caixa: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
      icone: <CheckCircle2Icon className="size-4 text-emerald-600" />,
      texto: "Valor da fábrica igual ao sugerido.",
    },
    ABAIXO: {
      caixa: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
      icone: <CheckCircle2Icon className="size-4 text-emerald-600" />,
      texto: `Fábrica ${formatarMoeda(Math.abs(c.diferenca ?? 0))} abaixo do sugerido.`,
    },
    ACIMA: {
      caixa: "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
      icone: <AlertTriangleIcon className="size-4 text-amber-600" />,
      texto: `Atenção: fábrica ${formatarMoeda(c.diferenca ?? 0)} acima do sugerido${
        c.sugerido > 0 ? ` (+${(((c.diferenca ?? 0) / c.sugerido) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)` : ""
      }. Confira o valor.`,
    },
  }[c.situacao];

  return (
    <div className={`flex flex-col gap-2 rounded-md border p-3 text-sm ${estilos.caixa}`}>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <span>
          <span className="text-muted-foreground">Custo sugerido: </span>
          <span className="font-semibold tabular-nums">{formatarMoeda(c.sugerido)}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Mercadoria lançada (fábrica): </span>
          <span className="font-semibold tabular-nums">{c.mercadoria === null ? "—" : formatarMoeda(c.mercadoria)}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Margem prevista com o sugerido: </span>
          <span className={`font-semibold tabular-nums ${c.margemPrevista < 0 ? "text-rose-700 dark:text-rose-400" : ""}`}>
            {formatarMoeda(c.margemPrevista)}
            {c.margemPrevistaPercentual !== null &&
              ` (${c.margemPrevistaPercentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)`}
          </span>
        </span>
      </div>
      <p className="flex items-center gap-1.5 font-medium">
        {estilos.icone} {estilos.texto}
      </p>
    </div>
  );
}
