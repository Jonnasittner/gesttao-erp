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
import { listarLancamentos } from "@/server/financeiro";
import { calcularResumo, estaVencido } from "@/lib/financeiro";
import { formatarCodigo } from "@/lib/codigo";
import { formatarMoeda } from "@/lib/moeda";
import { formatarDataISO, hojeISO } from "@/lib/datetime";
import { ROTULOS_FORMA_PAGAMENTO } from "@/lib/rotulos";
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
  const todos = await listarLancamentos();
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Recebimentos de clientes e pagamentos a fornecedores.</p>
        </div>
        <Button
          nativeButton={false}
          render={
            <Link href="/financeiro/novo">
              <PlusIcon /> Novo lançamento
            </Link>
          }
        />
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CartaoResumo
          titulo="A receber de clientes"
          valor={resumo.aReceber}
          detalhe={`Já recebido: ${formatarMoeda(resumo.recebido)}`}
          classeValor="text-emerald-700 dark:text-emerald-400"
          href={link({ tipo: "RECEBER", status: "" })}
        />
        <CartaoResumo
          titulo="A pagar a fornecedores"
          valor={resumo.aPagar}
          detalhe={`Já pago: ${formatarMoeda(resumo.pago)}`}
          classeValor="text-rose-700 dark:text-rose-400"
          href={link({ tipo: "PAGAR", status: "" })}
        />
        <CartaoResumo
          titulo="Saldo previsto"
          valor={resumo.saldoPrevisto}
          detalhe="A receber − a pagar (pendentes)"
          classeValor={
            resumo.saldoPrevisto < 0 ? "text-rose-700 dark:text-rose-400" : "text-foreground"
          }
          href={link({ tipo: "", status: "" })}
        />
        <CartaoResumo
          titulo="Vencidos"
          valor={resumo.vencidoReceber + resumo.vencidoPagar}
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
          <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
            Nenhum lançamento{todos.length === 0 ? " ainda." : " com esses filtros."}
          </p>
        )}
        {lista.map((l) => (
          <CartaoLancamento key={l.id} lancamento={l} hoje={hoje} mostrarPagamento={status === "pagos"} />
        ))}
      </div>

      {/* Lista — PC: tabela */}
      <div className="hidden overflow-x-auto rounded-lg border sm:block">
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
  const documento = formatarCodigo(l.numeroDocumento);
  const aReceber = l.tipo === "RECEBER";
  const vencido = estaVencido(l, hoje);

  return (
    <TableRow>
      <TableCell>
        <Link href={`/financeiro/${l.id}`} className="font-mono font-medium hover:underline">
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
        <span className="font-medium">{aReceber ? l.clienteNome : l.fornecedorNome}</span>
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
      <TableCell className="text-sm">{ROTULOS_FORMA_PAGAMENTO[l.formaPagamento] ?? "—"}</TableCell>
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
  const documento = formatarCodigo(l.numeroDocumento);
  const aReceber = l.tipo === "RECEBER";
  const nome = aReceber ? l.clienteNome : l.fornecedorNome;
  const detalhes = [
    l.pedidoNumero ? `Pedido ${formatarCodigo(l.pedidoNumero)}` : "",
    l.numeroPedidoFornecedor ? `Forn. ${l.numeroPedidoFornecedor}` : "",
    ROTULOS_FORMA_PAGAMENTO[l.formaPagamento] ?? "",
  ].filter(Boolean);

  return (
    <div className={`flex flex-col gap-2 rounded-lg border border-l-4 bg-card p-3 ${aReceber ? "border-l-emerald-500" : "border-l-rose-500"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/financeiro/${l.id}`} className="font-mono text-xs text-muted-foreground hover:underline">
            {documento} · {aReceber ? "Receber" : "Pagar"}
          </Link>
          <p className="font-medium leading-tight">{nome}</p>
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

function SituacaoBadge({ lancamento: l, hoje }: { lancamento: Lancamento; hoje: string }) {
  const aReceber = l.tipo === "RECEBER";
  if (l.status === "PAGO") return <Badge variant="secondary">{aReceber ? "Recebido" : "Pago"}</Badge>;
  if (estaVencido(l, hoje)) {
    return (
      <Badge
        variant="outline"
        className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      >
        Vencido
      </Badge>
    );
  }
  if (l.vencimento === hoje) return <Badge variant="outline">Vence hoje</Badge>;
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Pendente
    </Badge>
  );
}

function CartaoResumo({
  titulo,
  valor,
  detalhe,
  classeValor,
  href,
}: {
  titulo: string;
  valor: number;
  detalhe: string;
  classeValor: string;
  href: string;
}) {
  return (
    <Link href={href} className="flex flex-col gap-1 rounded-xl border bg-card p-3 transition-colors hover:bg-accent/50 sm:p-4">
      <span className="text-xs font-medium text-muted-foreground sm:text-sm">{titulo}</span>
      <span className={`text-lg font-bold tabular-nums sm:text-2xl ${classeValor}`}>{formatarMoeda(valor)}</span>
      <span className="text-[11px] text-muted-foreground sm:text-xs">{detalhe}</span>
    </Link>
  );
}

function GrupoFiltro({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1">{children}</div>;
}

function BotaoFiltro({ href, ativo, children }: { href: string; ativo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        ativo ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
