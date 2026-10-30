import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { VincularAsaas } from "@/components/financeiro/vincular-asaas";
import { ContaReceberClicavel } from "@/components/financeiro/detalhe-conta-receber";
import { configAsaas } from "@/lib/asaas";
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
import { formatarDataHoraSegundos, formatarDataISO, hojeISO } from "@/lib/datetime";
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
  searchParams: Promise<{ tipo?: string; status?: string } & Partial<Record<CampoBusca, string>>>;
}) {
  const params = await searchParams;
  const tipo = (FILTROS_TIPO.find((f) => f.valor === params.tipo)?.valor ?? "") as FiltroTipo;
  const status = (FILTROS_STATUS.find((f) => f.valor === params.status)?.valor ?? "") as FiltroStatus;
  const busca = lerBusca(params);

  const hoje = hojeISO();
  const [todos, bancosUsados] = await Promise.all([listarLancamentos(), listarBancosUsados()]);
  const resumo = calcularResumo(todos, hoje);
  const asaasConfigurado = configAsaas() !== null;

  const lista = todos.filter((l) => {
    if (tipo && l.tipo !== tipo) return false;
    if (!atendeBusca(l, busca, status === "pagos")) return false;
    if (status === "") return l.status === "PENDENTE";
    if (status === "vencidos") return estaVencido(l, hoje);
    if (status === "pagos") return l.status === "PAGO";
    return true;
  });
  // Pagos: mais recentes primeiro. Pendentes: o que vence antes primeiro.
  if (status === "pagos") lista.sort((a, b) => b.dataPagamento.localeCompare(a.dataPagamento));

  const totalLista = lista.reduce((soma, l) => soma + (l.tipo === "RECEBER" ? l.valor : -l.valor), 0);

  // Vindo de "Contas a pagar"/"Contas a receber" no menu, a tela mostra só
  // aquele tipo: título, resumo e total sem misturar com o outro lado.
  const aPagar = tipo === "PAGAR";
  const paginaDoTipo = tipo !== "";
  const rotuloPagos = tipo === "" ? "Recebidos / pagos" : aPagar ? "Pagos" : "Recebidos";
  const rotuloPendentes = tipo === "" ? "Pendentes" : aPagar ? "A pagar" : "A receber";
  const corTipo = aPagar ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400";
  const vencidoDoTipo = aPagar ? resumo.vencidoPagar : resumo.vencidoReceber;
  const qtdVencidosDoTipo = todos.filter((l) => l.tipo === tipo && estaVencido(l, hoje)).length;

  function link(novo: { tipo?: FiltroTipo; status?: FiltroStatus; limparBusca?: boolean }) {
    const query = new URLSearchParams();
    const t = novo.tipo ?? tipo;
    const s = novo.status ?? status;
    if (t) query.set("tipo", t);
    if (s) query.set("status", s);
    if (!novo.limparBusca) for (const campo of CAMPOS_BUSCA) if (busca[campo]) query.set(campo, busca[campo]);
    const texto = query.toString();
    return texto ? `/financeiro?${texto}` : "/financeiro";
  }

  return (
    <div className="flex flex-col gap-5" data-fundo={!paginaDoTipo ? undefined : aPagar ? "pagar" : "receber"}>
      <PageHeader
        titulo={!paginaDoTipo ? "Financeiro" : aPagar ? "Contas a pagar" : "Contas a receber"}
        descricao={
          !paginaDoTipo
            ? "Recebimentos de clientes e pagamentos a fornecedores."
            : aPagar
              ? "Pagamentos a fornecedores e custos dos pedidos."
              : "Recebimentos de clientes."
        }
        acoes={
          <>
            {tipo === "RECEBER" && asaasConfigurado && <VincularAsaas />}
            <Button
              nativeButton={false}
              render={
                <Link href={paginaDoTipo ? `/financeiro/novo?tipo=${tipo}` : "/financeiro/novo"}>
                  <PlusIcon /> Novo lançamento
                </Link>
              }
            />
          </>
        }
      />

      {/* Sugestões do campo banco na janela "Recebido/Pago" */}
      <datalist id={ID_LISTA_BANCOS}>
        {[...new Set([...bancosUsados, ...BANCOS_SUGERIDOS])].map((banco) => (
          <option key={banco} value={banco} />
        ))}
      </datalist>

      {/* Resumo */}
      {paginaDoTipo ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard
            titulo={aPagar ? "A pagar a fornecedores" : "A receber de clientes"}
            valor={formatarMoeda(aPagar ? resumo.aPagar : resumo.aReceber)}
            detalhe={aPagar ? "Ainda não pago" : "Ainda não recebido"}
            classeValor={corTipo}
            href={link({ status: "" })}
          />
          <StatCard
            titulo="Vencidos"
            valor={formatarMoeda(vencidoDoTipo)}
            detalhe={
              qtdVencidosDoTipo
                ? `${qtdVencidosDoTipo} ${qtdVencidosDoTipo === 1 ? "lançamento" : "lançamentos"}`
                : "Nenhum lançamento vencido"
            }
            classeValor={qtdVencidosDoTipo ? "text-amber-600 dark:text-amber-400" : "text-foreground"}
            href={link({ status: "vencidos" })}
          />
          <StatCard
            titulo={aPagar ? "Já pago" : "Já recebido"}
            valor={formatarMoeda(aPagar ? resumo.pago : resumo.recebido)}
            classeValor="text-foreground"
            href={link({ status: "pagos" })}
          />
        </div>
      ) : (
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
      )}

      {/* Filtros — em Contas a pagar/receber o tipo já vem do menu */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {!paginaDoTipo && (
          <GrupoFiltro>
            {FILTROS_TIPO.map((f) => (
              <BotaoFiltro key={f.label} href={link({ tipo: f.valor })} ativo={tipo === f.valor}>
                {f.label}
              </BotaoFiltro>
            ))}
          </GrupoFiltro>
        )}
        <GrupoFiltro>
          {FILTROS_STATUS.map((f) => (
            <BotaoFiltro key={f.label} href={link({ status: f.valor })} ativo={status === f.valor}>
              {f.valor === "pagos" ? rotuloPagos : f.valor === "" ? rotuloPendentes : f.label}
            </BotaoFiltro>
          ))}
        </GrupoFiltro>
      </div>

      {/* Busca por nome, período e valor — formulário GET, mantém tipo e situação */}
      <form action="/financeiro" className="superficie grid grid-cols-2 items-end gap-3 p-3 sm:grid-cols-3 lg:grid-cols-6">
        {tipo && <input type="hidden" name="tipo" value={tipo} />}
        {status && <input type="hidden" name="status" value={status} />}
        <CampoFiltro rotulo="Nome" className="col-span-2 sm:col-span-3 lg:col-span-2">
          <Input
            name="nome"
            defaultValue={busca.nome}
            placeholder={!paginaDoTipo ? "Cliente, fornecedor ou documento" : aPagar ? "Fornecedor ou documento" : "Cliente ou documento"}
          />
        </CampoFiltro>
        <CampoFiltro rotulo={status === "pagos" ? `${rotuloPagos} de` : "Vence de"}>
          <Input type="date" name="de" defaultValue={busca.de} />
        </CampoFiltro>
        <CampoFiltro rotulo="até">
          <Input type="date" name="ate" defaultValue={busca.ate} />
        </CampoFiltro>
        <CampoFiltro rotulo="Valor de (R$)">
          <Input type="number" name="valorMin" min="0" step="0.01" inputMode="decimal" defaultValue={busca.valorMin} />
        </CampoFiltro>
        <CampoFiltro rotulo="até (R$)">
          <Input type="number" name="valorMax" min="0" step="0.01" inputMode="decimal" defaultValue={busca.valorMax} />
        </CampoFiltro>
        <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-3 lg:col-span-6">
          {CAMPOS_BUSCA.some((c) => busca[c]) && (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href={link({ limparBusca: true })}>Limpar</Link>}
            />
          )}
          <Button type="submit" size="sm">
            Filtrar
          </Button>
        </div>
      </form>

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
              <TableHead>{status === "pagos" ? (tipo === "RECEBER" ? "Recebido em" : tipo === "PAGAR" ? "Pago em" : "Pago/recebido em") : "Vencimento"}</TableHead>
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
          {lista.length} {lista.length === 1 ? "lançamento" : "lançamentos"} ·{" "}
          {paginaDoTipo ? (
            <>
              Total desta lista:{" "}
              <span className={`font-semibold ${corTipo}`}>{formatarMoeda(Math.abs(totalLista))}</span>
            </>
          ) : (
            <>
              Saldo desta lista:{" "}
              <span className={`font-semibold ${totalLista < 0 ? "text-rose-700 dark:text-rose-400" : "text-foreground"}`}>
                {formatarMoeda(totalLista)}
              </span>
            </>
          )}
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
    // A receber: clicar na linha abre o pop-up com cliente, pedido e boletos.
    <ContaReceberClicavel como="linha" lancamentoId={l.id} ativo={aReceber}>
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
        {mostrarPagamento ? dataDoPagamento(l) : formatarDataISO(l.vencimento)}
      </TableCell>
      <TableCell
        className={`text-right font-semibold ${aReceber ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}
      >
        {aReceber ? "" : "− "}
        {formatarMoeda(l.valor)}
      </TableCell>
      <TableCell>
        <SituacaoBadge lancamento={l} hoje={hoje} />
        {!mostrarPagamento && l.pagoEm && (
          <span className="mt-1 block text-xs whitespace-nowrap text-muted-foreground">
            {formatarDataHoraSegundos(l.pagoEm)}
          </span>
        )}
      </TableCell>
      <TableCell>
        <LancamentoAcoes lancamento={l} documento={documento} />
      </TableCell>
    </ContaReceberClicavel>
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
    // A receber: tocar no cartão abre o pop-up com cliente, pedido e boletos.
    <ContaReceberClicavel
      como="cartao"
      lancamentoId={l.id}
      ativo={aReceber}
      className={`superficie flex flex-col gap-2 border-l-4 p-3 ${aReceber ? "border-l-emerald-500" : "border-l-rose-500"}`}
    >
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
          {mostrarPagamento ? `${aReceber ? "Recebido" : "Pago"} em ${dataDoPagamento(l)}` : `Vence ${formatarDataISO(l.vencimento)}`}
        </span>
        <SituacaoBadge lancamento={l} hoje={hoje} />
      </div>

      {l.descricao && <p className="text-xs text-muted-foreground">{l.descricao}</p>}

      <div className="border-t pt-2">
        <LancamentoAcoes lancamento={l} documento={documento} />
      </div>
    </ContaReceberClicavel>
  );
}


// ---------------------------------------------------------------------------
// Busca por nome, período e valor
// ---------------------------------------------------------------------------

const CAMPOS_BUSCA = ["nome", "de", "ate", "valorMin", "valorMax"] as const;
type CampoBusca = (typeof CAMPOS_BUSCA)[number];
type Busca = Record<CampoBusca, string>;

function lerBusca(params: Partial<Record<CampoBusca, string>>): Busca {
  const data = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
  const numero = (v?: string) => (v && Number.isFinite(Number(v)) ? v : "");
  return {
    nome: params.nome?.trim() ?? "",
    de: data(params.de),
    ate: data(params.ate),
    valorMin: numero(params.valorMin),
    valorMax: numero(params.valorMax),
  };
}

/** Minúsculas e sem acento, para "joao" achar "João". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Período compara a data de pagamento na aba de pagos e o vencimento nas demais. */
function atendeBusca(l: Lancamento, b: Busca, porPagamento: boolean): boolean {
  if (b.nome) {
    const alvo = normalizar(
      [nomeLancamento(l), l.clienteNome, l.fornecedorNome, l.descricao, l.numeroDocumento].filter(Boolean).join(" ")
    );
    if (!alvo.includes(normalizar(b.nome))) return false;
  }
  const data = porPagamento ? l.dataPagamento : l.vencimento;
  if (b.de && (!data || data < b.de)) return false;
  if (b.ate && (!data || data > b.ate)) return false;
  if (b.valorMin && l.valor < Number(b.valorMin)) return false;
  if (b.valorMax && l.valor > Number(b.valorMax)) return false;
  return true;
}

function CampoFiltro({
  rotulo,
  className = "",
  children,
}: {
  rotulo: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs font-medium text-muted-foreground ${className}`}>
      {rotulo}
      {children}
    </label>
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

/** Com o horário exato quando o pagamento veio do Asaas; baixa à mão só tem o dia. */
function dataDoPagamento(l: Lancamento): string {
  return l.pagoEm ? formatarDataHoraSegundos(l.pagoEm) : formatarDataISO(l.dataPagamento);
}

/** Cliente (a receber) ou fornecedor (a pagar); custo sem fornecedor mostra o tipo (ex.: "Frete"). */
function nomeLancamento(l: Lancamento): string {
  if (l.tipo === "RECEBER") return l.clienteNome;
  return l.fornecedorNome || rotuloCategoria(l) || "Custo";
}
