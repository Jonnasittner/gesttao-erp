import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LancamentoAcoes } from "@/components/financeiro/lancamento-acoes";
import { SituacaoBadge } from "@/components/financeiro/situacao-badge";
import { listarBancosUsados, listarLancamentos } from "@/server/financeiro";
import {
  BANCOS_SUGERIDOS,
  ID_LISTA_BANCOS,
  calcularResumo,
  estaVencido,
  rotuloDocumento,
} from "@/lib/financeiro";
import { formatarCodigo } from "@/lib/codigo";
import { formatarMoeda } from "@/lib/moeda";
import { formatarDataISO, hojeISO } from "@/lib/datetime";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ROTULOS_CATEGORIA_CUSTO, ROTULOS_FORMA_PAGAMENTO } from "@/lib/rotulos";
import type { Lancamento } from "@/lib/types";

const FILTROS_TIPO = [
  { valor: "", label: "Todos" },
  { valor: "RECEBER", label: "A receber" },
  { valor: "PAGAR", label: "A pagar" },
] as const;

const FILTROS_STATUS = [
  { valor: "", label: "Pendentes" },
  { valor: "vencidos", label: "Vencidos" },
  { valor: "pagos", label: "Recebidos / pagos" },
  { valor: "todos", label: "Todos" },
] as const;

type FiltroTipo = (typeof FILTROS_TIPO)[number]["valor"];
type FiltroStatus = (typeof FILTROS_STATUS)[number]["valor"];

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; status?: string }>;
}) {
  const params = await searchParams;
  const tipo = (FILTROS_TIPO.find((f) => f.valor === params.tipo)?.valor ?? "") as FiltroTipo;
  const status = (FILTROS_STATUS.find((f) => f.valor === params.status)?.valor ?? "") as FiltroStatus;

  const hoje = hojeISO();
  const [todos, bancosUsados] = await Promise.all([listarLancamentos(), listarBancosUsados()]);
  const resumo = calcularResumo(todos, hoje);

  const lista = todos.filter((l) => {
    if (tipo && l.tipo !== tipo) return false;
    if (status === "") return l.status === "PENDENTE";
    if (status === "vencidos") return estaVencido(l, hoje);
    if (status === "pagos") return l.status === "PAGO";
    return true;
  });
  // Pagos: mais recentes primeiro. Pendentes: o que vence antes primeiro.
  if (status === "pagos") lista.sort((a, b) => b.dataPagamento.localeCompare(a.dataPagamento));

  const totalLista = lista.reduce((soma, l) => soma + (l.tipo === "RECEBER" ? l.valor : -l.valor), 0);

  function link(novo: { tipo?: FiltroTipo; status?: FiltroStatus }) {
    const busca = new URLSearchParams();
    const t = novo.tipo ?? tipo;
    const s = novo.status ?? status;
    if (t) busca.set("tipo", t);
    if (s) busca.set("status", s);
    const texto = busca.toString();
    return texto ? `/financeiro?${texto}` : "/financeiro";
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Financeiro"
        descricao="Recebimentos de clientes e pagamentos a fornecedores."
        acoes={
          <Button
            nativeButton={false}
            render={
              <Link href="/financeiro/novo">
                <PlusIcon /> Novo lançamento
              </Link>
            }
          />
        }
      />

      {/* Sugestões do campo banco na janela "Recebido/Pago" */}
      <datalist id={ID_LISTA_BANCOS}>
        {[...new Set([...bancosUsados, ...BANCOS_SUGERIDOS])].map((banco) => (
          <option key={banco} value={banco} />
        ))}
      </datalist>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          titulo="A receber de clientes"
          valor={formatarMoeda(resumo.aReceber)}
          detalhe={`Já recebido: ${formatarMoeda(resumo.recebido)}`}
          classeValor="text-emerald-700 dark:text-emerald-400"
          href={link({ tipo: "RECEBER", status: "" })}
        />
        <StatCard
          titulo="A pagar a fornecedores"
          valor={formatarMoeda(resumo.aPagar)}
          detalhe={`Já pago: ${formatarMoeda(resumo.pago)}`}
          classeValor="text-rose-700 dark:text-rose-400"
          href={link({ tipo: "PAGAR", status: "" })}
        />
        <StatCard
          titulo="Saldo previsto"
          valor={formatarMoeda(resumo.saldoPrevisto)}
          detalhe="A receber − a pagar (pendentes)"
          classeValor={
            resumo.saldoPrevisto < 0 ? "text-rose-700 dark:text-rose-400" : "text-foreground"
          }
          href={link({ tipo: "", status: "" })}
        />
        <StatCard
          titulo="Vencidos"
          valor={formatarMoeda(resumo.vencidoReceber + resumo.vencidoPagar)}
          detalhe={
            resumo.qtdVencidos
              ? `Receber ${formatarMoeda(resumo.vencidoReceber)} · Pagar ${formatarMoeda(resumo.vencidoPagar)}`
              : "Nenhum lançamento vencido"
          }
          classeValor={resumo.qtdVencidos ? "text-amber-600 dark:text-amber-400" : "text-foreground"}
          href={link({ tipo: "", status: "vencidos" })}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <GrupoFiltro>
          {FILTROS_TIPO.map((f) => (
            <BotaoFiltro key={f.label} href={link({ tipo: f.valor })} ativo={tipo === f.valor}>
              {f.label}
            </BotaoFiltro>
          ))}
        </GrupoFiltro>
        <GrupoFiltro>
          {FILTROS_STATUS.map((f) => (
            <BotaoFiltro key={f.label} href={link({ status: f.valor })} ativo={status === f.valor}>
              {f.label}
            </BotaoFiltro>
          ))}
        </GrupoFiltro>
      </div>

      {/* Lista — celular: cartões */}
      <div className="flex flex-col gap-2 sm:hidden">
        {lista.length === 0 && (
          <p className="superficie py-10 text-center text-sm text-muted-foreground">
            Nenhum lançamento{todos.length === 0 ? " ainda." : " com esses filtros."}
          </p>
        )}
        {lista.map((l) => (
          <CartaoLancamento key={l.id} lancamento={l} hoje={hoje} mostrarPagamento={status === "pagos"} />
        ))}
      </div>

      {/* Lista — PC: tabela */}
      <div className="superficie hidden overflow-x-auto sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Doc.</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cliente / Fornecedor</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead>{status === "pagos" ? "Pago em" : "Vencimento"}</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  Nenhum lançamento{todos.length === 0 ? " ainda. Clique em \"Novo lançamento\" para começar." : " com esses filtros."}
                </TableCell>
              </TableRow>
            )}
            {lista.map((l) => (
              <LinhaLancamento key={l.id} lancamento={l} hoje={hoje} mostrarPagamento={status === "pagos"} />
            ))}
          </TableBody>
        </Table>
      </div>

      {lista.length > 0 && (
        <p className="text-right text-sm text-muted-foreground">
          {lista.length} {lista.length === 1 ? "lançamento" : "lançamentos"} · Saldo desta lista:{" "}
          <span className={`font-semibold ${totalLista < 0 ? "text-rose-700 dark:text-rose-400" : "text-foreground"}`}>
            {formatarMoeda(totalLista)}
          </span>
        </p>
      )}
    </div>
  );
}

function LinhaLancamento({
  lancamento: l,
  hoje,
  mostrarPagamento,
}: {
  lancamento: Lancamento;
  hoje: string;
  mostrarPagamento: boolean;
}) {
  const documento = rotuloDocumento(l.numeroDocumento, l.parcela, l.totalParcelas);
  const aReceber = l.tipo === "RECEBER";
  const vencido = estaVencido(l, hoje);

  return (
    <TableRow>
      <TableCell>
        <Link href={`/financeiro/${l.id}`} className="whitespace-nowrap font-mono font-medium hover:underline">
          {documento}
        </Link>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            aReceber
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
          }
        >
          {aReceber ? "Receber" : "Pagar"}
        </Badge>
      </TableCell>
      <TableCell className="min-w-44 whitespace-normal">
        <span className="font-medium">{nomeLancamento(l)}</span>
        {!aReceber && l.categoria && l.fornecedorNome && (
          <span className="ml-1.5 text-xs text-muted-foreground">({rotuloCategoria(l)})</span>
        )}
        {!aReceber && l.clienteNome && (
          <span className="block text-xs text-muted-foreground">Cliente: {l.clienteNome}</span>
        )}
        {l.descricao && <span className="block text-xs text-muted-foreground">{l.descricao}</span>}
      </TableCell>
      <TableCell className="whitespace-normal text-sm">
        {l.pedidoNumero ? (
          <Link href={`/pedidos/${l.pedidoId}`} className="hover:underline">
            {formatarCodigo(l.pedidoNumero)}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        {l.numeroPedidoFornecedor && (
          <span className="block text-xs text-muted-foreground">Forn.: {l.numeroPedidoFornecedor}</span>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {ROTULOS_FORMA_PAGAMENTO[l.formaPagamento] ?? "—"}
        {l.status === "PAGO" && l.banco && (
          <span className="block text-xs text-muted-foreground">{l.banco}</span>
        )}
      </TableCell>
      <TableCell className={`text-sm ${vencido ? "font-semibold text-amber-600 dark:text-amber-400" : ""}`}>
        {formatarDataISO(mostrarPagamento ? l.dataPagamento : l.vencimento)}
      </TableCell>
      <TableCell
        className={`text-right font-semibold ${aReceber ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}
      >
        {aReceber ? "" : "− "}
        {formatarMoeda(l.valor)}
      </TableCell>
      <TableCell>
        <SituacaoBadge lancamento={l} hoje={hoje} />
      </TableCell>
      <TableCell>
        <LancamentoAcoes lancamento={l} documento={documento} />
      </TableCell>
    </TableRow>
  );
}

/** Mesma informação da linha da tabela, empilhada para caber no celular. */
function CartaoLancamento({
  lancamento: l,
  hoje,
  mostrarPagamento,
}: {
  lancamento: Lancamento;
  hoje: string;
  mostrarPagamento: boolean;
}) {
  const documento = rotuloDocumento(l.numeroDocumento, l.parcela, l.totalParcelas);
  const aReceber = l.tipo === "RECEBER";
  const nome = nomeLancamento(l);
  const categoria = !aReceber && l.fornecedorNome ? rotuloCategoria(l) : "";
  const detalhes = [
    l.pedidoNumero ? `Pedido ${formatarCodigo(l.pedidoNumero)}` : "",
    l.numeroPedidoFornecedor ? `Forn. ${l.numeroPedidoFornecedor}` : "",
    ROTULOS_FORMA_PAGAMENTO[l.formaPagamento] ?? "",
    l.status === "PAGO" ? l.banco : "",
  ].filter(Boolean);

  return (
    <div className={`superficie flex flex-col gap-2 border-l-4 p-3 ${aReceber ? "border-l-emerald-500" : "border-l-rose-500"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/financeiro/${l.id}`} className="font-mono text-xs text-muted-foreground hover:underline">
            {documento} · {aReceber ? "Receber" : "Pagar"}
          </Link>
          <p className="font-medium leading-tight">
            {nome}
            {categoria && <span className="ml-1 text-xs font-normal text-muted-foreground">({categoria})</span>}
          </p>
          {!aReceber && l.clienteNome && <p className="text-xs text-muted-foreground">Cliente: {l.clienteNome}</p>}
        </div>
        <span className={`shrink-0 font-semibold tabular-nums ${aReceber ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
          {aReceber ? "" : "− "}
          {formatarMoeda(l.valor)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {detalhes.map((d) => (
          <span key={d}>{d}</span>
        ))}
        <span>·</span>
        <span className={estaVencido(l, hoje) ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
          {mostrarPagamento ? "Pago em " : "Vence "}
          {formatarDataISO(mostrarPagamento ? l.dataPagamento : l.vencimento)}
        </span>
        <SituacaoBadge lancamento={l} hoje={hoje} />
      </div>

      {l.descricao && <p className="text-xs text-muted-foreground">{l.descricao}</p>}

      <div className="border-t pt-2">
        <LancamentoAcoes lancamento={l} documento={documento} />
      </div>
    </div>
  );
}


function GrupoFiltro({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1">{children}</div>;
}

function BotaoFiltro({ href, ativo, children }: { href: string; ativo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
        ativo
          ? "bg-card text-foreground sombra-suave ring-1 ring-border"
          : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

function rotuloCategoria(l: Lancamento): string {
  return l.categoria ? ROTULOS_CATEGORIA_CUSTO[l.categoria].replace(" (fornecedor)", "") : "";
}

/** Cliente (a receber) ou fornecedor (a pagar); custo sem fornecedor mostra o tipo (ex.: "Frete"). */
function nomeLancamento(l: Lancamento): string {
  if (l.tipo === "RECEBER") return l.clienteNome;
  return l.fornecedorNome || rotuloCategoria(l) || "Custo";
}
