import Link from "next/link";
import { ArrowDownCircle, ArrowUpCircle, PlusIcon, TruckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LancamentoAcoes } from "@/components/financeiro/lancamento-acoes";
import { SituacaoBadge } from "@/components/financeiro/situacao-badge";
import { ID_LISTA_BANCOS, calcularMargemPedido, estaVencido, rotuloDocumento } from "@/lib/financeiro";
import { formatarMoeda } from "@/lib/moeda";
import { formatarDataISO, hojeISO } from "@/lib/datetime";
import { ROTULOS_CATEGORIA_CUSTO, ROTULOS_FORMA_PAGAMENTO } from "@/lib/rotulos";
import { CATEGORIA_CUSTO, type Lancamento, type Pedido } from "@/lib/types";

interface FinanceiroPedidoProps {
  pedido: Pedido;
  lancamentos: Lancamento[];
  sugestoesBanco: string[];
}

/**
 * Visão financeira centralizada do pedido: o que o cliente paga, o que foi
 * gasto (fornecedor, frete...) e a margem que sobra.
 */
export function FinanceiroPedido({ pedido, lancamentos, sugestoesBanco }: FinanceiroPedidoProps) {
  const hoje = hojeISO();
  const voltarPara = `/pedidos/${pedido.id}`;
  const recebimentos = lancamentos.filter((l) => l.tipo === "RECEBER");
  const custos = lancamentos.filter((l) => l.tipo === "PAGAR");
  const margem = calcularMargemPedido(pedido.total, lancamentos);
  const isPedido = pedido.status === "PEDIDO";

  const linkNovo = (tipo: "RECEBER" | "PAGAR", categoria?: string) =>
    `/financeiro/novo?pedido=${pedido.id}&tipo=${tipo}${categoria ? `&categoria=${categoria}` : ""}`;

  if (!isPedido && lancamentos.length === 0) {
    return (
      <section className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <h2 className="mb-1 font-medium text-foreground">Financeiro do pedido</h2>
        Ao transformar este orçamento em pedido, você informa a condição de pagamento. Depois, aqui mesmo, lança
        os custos (fornecedor, frete...) e acompanha a margem.
      </section>
    );
  }

  const corMargem =
    margem.margem < 0
      ? "text-rose-700 dark:text-rose-400"
      : "text-emerald-700 dark:text-emerald-400";

  return (
    <section className="flex flex-col gap-5 rounded-lg border p-4">
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
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-3 sm:p-4">
          <span className="text-xs font-medium text-muted-foreground sm:text-sm">Custos por tipo</span>
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
    <div className={`flex flex-col gap-1 rounded-xl border p-3 sm:p-4 ${destaque ? "bg-muted/50" : "bg-card"}`}>
      <span className="text-xs font-medium text-muted-foreground sm:text-sm">{titulo}</span>
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
}: {
  icone: React.ReactNode;
  titulo: string;
  acoes: React.ReactNode;
  vazio: string;
  itens: Lancamento[];
  hoje: string;
  voltarPara: string;
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

      {itens.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="divide-y rounded-md border">
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
