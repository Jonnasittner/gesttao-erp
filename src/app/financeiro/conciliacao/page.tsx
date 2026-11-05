import Link from "next/link";
import { ArrowDownLeftIcon, ArrowUpRightIcon, ReceiptIcon, SparklesIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  AtualizarExtrato,
  DesfazerJustificativa,
  JustificarMovimentacao,
} from "@/components/financeiro/justificar-movimentacao";
import { listarMovimentacoes } from "@/server/conciliacao";
import { configAsaas } from "@/lib/asaas";
import { INICIO_CONCILIACAO, resumoMovimentacao, rotuloTipoMovimentacao } from "@/lib/conciliacao";
import { formatarMoeda } from "@/lib/moeda";
import { formatarDataHoraSegundos, formatarDataISO } from "@/lib/datetime";
import { ROTULOS_CATEGORIA_CUSTO } from "@/lib/rotulos";
import { cn } from "@/lib/utils";
import { listarClassesDespesa } from "@/server/classes-despesa";
import { listarCadastros } from "@/server/cadastros";
import type { CadastroOpcao } from "@/components/financeiro/lancamento-form";
import type { ClasseDespesa, MovimentacaoAsaas } from "@/lib/types";

const FILTROS = [
  { valor: "", label: "Pendentes" },
  { valor: "justificadas", label: "Justificadas" },
  { valor: "todas", label: "Todas" },
] as const;

export default async function ConciliacaoPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const params = await searchParams;
  const ver = FILTROS.find((f) => f.valor === params.ver)?.valor ?? "";
  const config = configAsaas();
  const [{ pendentes, justificadas, novasDesde }, todasClasses, cadastrosFornecedor] = await Promise.all([
    listarMovimentacoes(),
    listarClassesDespesa(),
    listarCadastros("FORNECEDOR"),
  ]);
  const fornecedores: CadastroOpcao[] = cadastrosFornecedor
    .map((f) => ({ value: f.id, label: f.nome }))
    .sort((a, b) => a.label.localeCompare(b.label));
  // Só as ativas viram opção no "Lançar gasto".
  const classes = todasClasses
    .filter((c) => c.ativa)
    .map((c) => ({ ...c, subclasses: c.subclasses.filter((s) => s.ativa) }));

  const lista =
    ver === "" ? pendentes : ver === "justificadas" ? justificadas : [...pendentes, ...justificadas].sort(
      (a, b) => b.data.localeCompare(a.data) || b.criadaEm.localeCompare(a.criadaEm)
    );
  const saidasPendentes = pendentes.filter((m) => m.valor < 0).reduce((s, m) => s + m.valor, 0);
  const entradasPendentes = pendentes.filter((m) => m.valor > 0).reduce((s, m) => s + m.valor, 0);
  // Saldo da última movimentação conhecida (extrato em ordem de data).
  const maisRecente = [...pendentes, ...justificadas].sort(
    (a, b) => b.data.localeCompare(a.data) || b.criadaEm.localeCompare(a.criadaEm)
  )[0];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Conciliação"
        descricao={`Extrato do Asaas desde ${formatarDataISO(INICIO_CONCILIACAO)}`}
        selo={
          pendentes.length > 0 ? (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
              </span>
              {pendentes.length} {pendentes.length === 1 ? "pendente" : "pendentes"}
            </span>
          ) : undefined
        }
        acoes={config ? <AtualizarExtrato /> : undefined}
      />

      {!config && (
        <p className="superficie p-4 text-sm text-muted-foreground">
          O Asaas não está configurado (ASAAS_API_KEY). Sem ele não há extrato para conciliar.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          titulo="A justificar"
          valor={pendentes.length}
          detalhe={pendentes.length ? "Movimentações sem explicação" : "Tudo justificado"}
          classeValor={pendentes.length ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}
          href="/financeiro/conciliacao"
        />
        <StatCard
          titulo="Saídas pendentes"
          valor={formatarMoeda(Math.abs(saidasPendentes))}
          classeValor="text-rose-700 dark:text-rose-400"
        />
        <StatCard
          titulo="Entradas pendentes"
          valor={formatarMoeda(entradasPendentes)}
          classeValor="text-emerald-700 dark:text-emerald-400"
        />
        <StatCard
          titulo="Saldo no Asaas"
          valor={maisRecente ? formatarMoeda(maisRecente.saldo) : "—"}
          detalhe={maisRecente ? `Após a movimentação de ${formatarDataISO(maisRecente.data)}` : "Sem movimentações ainda"}
        />
      </div>

      <div className="flex flex-wrap gap-1 self-start rounded-xl border bg-muted/40 p-1">
        {FILTROS.map((f) => (
          <Link
            key={f.label}
            href={f.valor ? `/financeiro/conciliacao?ver=${f.valor}` : "/financeiro/conciliacao"}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              ver === f.valor
                ? "bg-card text-foreground sombra-suave ring-1 ring-border"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            }`}
          >
            {f.label}
            {f.valor === "" && pendentes.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">{pendentes.length}</span>
            )}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {lista.length === 0 && (
          <p className="superficie py-10 text-center text-sm text-muted-foreground">
            {ver === "" ? "Nenhuma movimentação esperando justificativa. 🎉" : "Nenhuma movimentação ainda."}
          </p>
        )}
        {lista.map((m) => (
          <LinhaMovimentacao
            key={m.id}
            m={m}
            nova={m.status === "PENDENTE" && m.criadaEm > novasDesde}
            classes={classes}
            fornecedores={fornecedores}
          />
        ))}
      </div>
    </div>
  );
}

function LinhaMovimentacao({
  m,
  nova,
  classes,
  fornecedores,
}: {
  m: MovimentacaoAsaas;
  nova: boolean;
  classes: ClasseDespesa[];
  fornecedores: CadastroOpcao[];
}) {
  const saida = m.valor < 0;
  const pendente = m.status === "PENDENTE";
  const j = m.justificativa;
  const quem = m.contraparte || m.descricao;

  return (
    <div
      className={cn(
        "superficie flex flex-col gap-3 border-l-4 p-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4",
        pendente ? "border-l-amber-500" : "border-l-emerald-500/60",
        nova && "movimentacao-nova"
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
            saida
              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
          )}
        >
          {saida ? <ArrowUpRightIcon className="size-4.5" /> : <ArrowDownLeftIcon className="size-4.5" />}
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium leading-tight">
            {rotuloTipoMovimentacao(m.tipo)}
            {nova && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
                <SparklesIcon className="size-3" /> Nova
              </span>
            )}
          </p>
          {quem && <p className="truncate text-sm">{quem}</p>}
          <p className="text-xs text-muted-foreground">
            {formatarDataISO(m.data)}
            {m.contraparte && m.descricao && ` · ${m.descricao}`}
          </p>
          {j && (
            <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
              <span className="font-semibold">✓ {j.texto || "Justificada"}</span>
              {j.categoria && ` · ${ROTULOS_CATEGORIA_CUSTO[j.categoria]}`}
              {j.classe && ` · ${j.classe}`}
              {j.documento && j.lancamentoId && (
                <>
                  {" · "}
                  <Link href={`/financeiro/${j.lancamentoId}`} className="font-mono underline-offset-2 hover:underline">
                    doc. {j.documento}
                  </Link>
                </>
              )}
              {m.comprovanteUrl && (
                <>
                  {" · "}
                  <a
                    href={m.comprovanteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 font-semibold underline-offset-2 hover:underline"
                  >
                    <ReceiptIcon className="size-3" /> cupom
                  </a>
                </>
              )}
              <span className="text-muted-foreground">
                {" · "}
                {j.modo === "AUTOMATICA" ? "pelo sistema" : j.usuarioNome ?? "—"}
                {j.em && ` em ${formatarDataHoraSegundos(j.em)}`}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span
          className={cn(
            "font-semibold tabular-nums",
            saida ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"
          )}
        >
          {saida ? "− " : "+ "}
          {formatarMoeda(Math.abs(m.valor))}
        </span>
        {pendente ? (
          <JustificarMovimentacao movimentacao={m} resumo={resumoMovimentacao(m)} classes={classes} fornecedores={fornecedores} />
        ) : (
          <div className="flex items-center gap-1">
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              Justificada
            </Badge>
            {j && j.modo !== "AUTOMATICA" && (
              <DesfazerJustificativa
                movimentacaoId={m.id}
                aviso={
                  j.modo === "LANCADA"
                    ? `Desfazer? O lançamento ${j.documento} criado por esta justificativa será excluído.`
                    : j.modo === "VINCULADA" && j.marcouPago
                      ? `Desfazer? A conta ${j.documento} volta para pendente.`
                      : "Desfazer a justificativa?"
                }
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
