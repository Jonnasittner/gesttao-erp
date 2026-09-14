"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Search, 
  LayoutGrid, 
  List, 
  ChevronLeft, 
  ChevronRight, 
  CalendarClock, 
  DollarSign, 
  CheckCircle2, 
  Clock,
  Loader2,
  Calendar,
  AlertCircle,
  TrendingUp,
  FileText,
  User,
  Plus
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EtapaInteracaoSelect } from "@/components/crm/etapa-interacao-select";
import { ReagendarInteracao } from "@/components/crm/reagendar-interacao";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { InteracaoForm } from "@/components/crm/interacao-form";
import { atualizarEtapaInteracao } from "@/server/crm";
import { ETAPA_ATENDIMENTO, type EtapaAtendimento, type Atendimento, type Cadastro } from "@/lib/types";
import { ROTULOS_ETAPA_ATENDIMENTO, ROTULOS_TIPO_INTERACAO } from "@/lib/rotulos";
import { formatarReagendamento } from "@/lib/datetime";

interface CrmBoardClientProps {
  atendimentos: Atendimento[];
  cadastros: Cadastro[];
}

const CORES_ETAPA: Record<string, { bg: string; text: string; border: string; indicator: string }> = {
  NOVO: { bg: "bg-blue-500/5 dark:bg-blue-500/2", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20 dark:border-blue-500/10", indicator: "bg-blue-500" },
  AGUARDANDO_RETORNO: { bg: "bg-amber-500/5 dark:bg-amber-500/2", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20 dark:border-amber-500/10", indicator: "bg-amber-500" },
  QUALIFICADO: { bg: "bg-violet-500/5 dark:bg-violet-500/2", text: "text-violet-600 dark:text-violet-400", border: "border-violet-500/20 dark:border-violet-500/10", indicator: "bg-violet-500" },
  AG_ORCAMENTO_FABRICA: { bg: "bg-fuchsia-500/5 dark:bg-fuchsia-500/2", text: "text-fuchsia-600 dark:text-fuchsia-400", border: "border-fuchsia-500/20 dark:border-fuchsia-500/10", indicator: "bg-fuchsia-500" },
  PROPOSTA: { bg: "bg-indigo-500/5 dark:bg-indigo-500/2", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/20 dark:border-indigo-500/10", indicator: "bg-indigo-500" },
  GANHO: { bg: "bg-emerald-500/5 dark:bg-emerald-500/2", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20 dark:border-emerald-500/10", indicator: "bg-emerald-500" },
  PERDIDO: { bg: "bg-rose-500/5 dark:bg-rose-500/2", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/20 dark:border-rose-500/10", indicator: "bg-rose-500" },
  FINALIZADO: { bg: "bg-muted/15 dark:bg-muted/5", text: "text-muted-foreground", border: "border-muted/30", indicator: "bg-muted-foreground" },
};

// Column divisions
const COLUNAS_ATIVAS: EtapaAtendimento[] = ["NOVO", "AGUARDANDO_RETORNO", "QUALIFICADO", "AG_ORCAMENTO_FABRICA", "PROPOSTA"];
const COLUNAS_FINALIZADAS: EtapaAtendimento[] = ["GANHO", "PERDIDO", "FINALIZADO"];
const TODAS_COLUNAS: EtapaAtendimento[] = [...ETAPA_ATENDIMENTO];

export function CrmBoardClient({ atendimentos, cadastros }: CrmBoardClientProps) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState<"ativos" | "finalizados" | "todos">("ativos");
  const [visualizacao, setVisualizacao] = useState<"kanban" | "tabela">("kanban");
  const [isPending, startTransition] = useTransition();
  const [movendoCardId, setMovendoCardId] = useState<string | null>(null);
  
  // Dialog (Modal) state
  const [selectedAtendimentoId, setSelectedAtendimentoId] = useState<string | null>(null);

  const nomePorCadastro = useMemo(() => {
    return new Map(cadastros.map((c) => [c.id, c.nome]));
  }, [cadastros]);

  // Derived selected atendimento from active props
  const atendimentoSelecionado = useMemo(() => {
    return atendimentos.find((a) => a.atendimentoId === selectedAtendimentoId) || null;
  }, [atendimentos, selectedAtendimentoId]);

  // Filter column array based on active tab
  const colunasExibidas = useMemo(() => {
    if (filtroGrupo === "ativos") return COLUNAS_ATIVAS;
    if (filtroGrupo === "finalizados") return COLUNAS_FINALIZADAS;
    return TODAS_COLUNAS;
  }, [filtroGrupo]);

  // Filter atendimentos based on search text
  const atendimentosFiltrados = useMemo(() => {
    if (!busca.trim()) return atendimentos;
    const termo = busca.toLowerCase().trim();
    return atendimentos.filter((a) => {
      const nomeCliente = (nomePorCadastro.get(a.cadastroId) || "").toLowerCase();
      const ultimaInteracao = a.interacoes[a.interacoes.length - 1];
      const descricao = (ultimaInteracao?.descricao || "").toLowerCase();
      return nomeCliente.includes(termo) || descricao.includes(termo);
    });
  }, [atendimentos, busca, nomePorCadastro]);

  // Handle quick moving of a card to next/previous step
  function moverEtapa(interacaoId: string, atualEtapa: EtapaAtendimento, direcao: "next" | "prev") {
    const currentIndex = ETAPA_ATENDIMENTO.indexOf(atualEtapa);
    let nextIndex = currentIndex;
    
    if (direcao === "next" && currentIndex < ETAPA_ATENDIMENTO.length - 1) {
      nextIndex = currentIndex + 1;
    } else if (direcao === "prev" && currentIndex > 0) {
      nextIndex = currentIndex - 1;
    }
    
    if (nextIndex === currentIndex) return;
    
    const novaEtapa = ETAPA_ATENDIMENTO[nextIndex];
    setMovendoCardId(interacaoId);
    
    startTransition(async () => {
      try {
        await atualizarEtapaInteracao(interacaoId, novaEtapa);
        toast.success(`Movido para "${ROTULOS_ETAPA_ATENDIMENTO[novaEtapa]}".`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao mover.");
      } finally {
        setMovendoCardId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Search and Filters Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-muted shadow-sm">
        {/* Left Side: Stage Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border dark:border-white/5 w-fit">
          <Button
            type="button"
            size="sm"
            variant={filtroGrupo === "ativos" ? "default" : "ghost"}
            className="h-8 text-xs font-semibold px-3 py-1.5 rounded-lg"
            onClick={() => setFiltroGrupo("ativos")}
          >
            Em Andamento ({atendimentos.filter(a => COLUNAS_ATIVAS.includes(a.etapa)).length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filtroGrupo === "finalizados" ? "default" : "ghost"}
            className="h-8 text-xs font-semibold px-3 py-1.5 rounded-lg"
            onClick={() => setFiltroGrupo("finalizados")}
          >
            Concluídos ({atendimentos.filter(a => COLUNAS_FINALIZADAS.includes(a.etapa)).length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filtroGrupo === "todos" ? "default" : "ghost"}
            className="h-8 text-xs font-semibold px-3 py-1.5 rounded-lg"
            onClick={() => setFiltroGrupo("todos")}
          >
            Todos ({atendimentos.length})
          </Button>
        </div>

        {/* Right Side: Search and layout toggles */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1 md:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar cliente ou descrição..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-background/50 border-muted focus:bg-background w-full"
            />
          </div>

          {/* Kanban / Table Toggle */}
          <div className="flex items-center rounded-xl bg-muted/40 p-1 border dark:border-white/5">
            <Button
              type="button"
              variant={visualizacao === "kanban" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7 rounded-lg"
              title="Visualizar como Kanban"
              onClick={() => setVisualizacao("kanban")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={visualizacao === "tabela" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7 rounded-lg"
              title="Visualizar como Lista"
              onClick={() => setVisualizacao("tabela")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Board View */}
      {visualizacao === "kanban" ? (
        /* ==================== KANBAN BOARD VIEW ==================== */
        <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin select-none snap-x snap-mandatory">
          {colunasExibidas.map((etapa) => {
            const itens = atendimentosFiltrados.filter((a) => a.etapa === etapa);
            const cor = CORES_ETAPA[etapa] || CORES_ETAPA.FINALIZADO;
            
            return (
              <div 
                key={etapa} 
                className={`flex flex-col gap-3 min-w-[290px] w-[290px] p-3 rounded-2xl border ${cor.bg} ${cor.border} shrink-0 snap-start`}
              >
                {/* Header Column */}
                <div className="flex items-center justify-between border-b pb-2.5 mb-1 border-muted/20">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${cor.indicator} animate-pulse`} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${cor.text}`}>
                      {ROTULOS_ETAPA_ATENDIMENTO[etapa]}
                    </span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-background border text-muted-foreground shadow-sm">
                    {itens.length}
                  </span>
                </div>

                {/* Card List container */}
                <div className="flex flex-col gap-2 overflow-y-auto max-h-[60vh] pr-1 scrollbar-thin">
                  {itens.length === 0 ? (
                    <div className="text-center py-10 border border-dashed rounded-xl bg-background/30 border-muted/30">
                      <p className="text-xs text-muted-foreground/50 font-medium">Sem contatos</p>
                    </div>
                  ) : (
                    itens.map((atendimento) => {
                      const ultima = atendimento.interacoes[atendimento.interacoes.length - 1];
                      const isSaving = movendoCardId === ultima.id;
                      
                      const currentIndex = ETAPA_ATENDIMENTO.indexOf(atendimento.etapa);
                      const hasPrev = currentIndex > 0;
                      const hasNext = currentIndex < ETAPA_ATENDIMENTO.length - 1;

                      return (
                        <Card 
                          key={atendimento.atendimentoId}
                          className="hover:shadow-md transition-all duration-200 border-muted/80 bg-card overflow-hidden group relative shrink-0 cursor-pointer hover:border-primary/40"
                          onClick={() => setSelectedAtendimentoId(atendimento.atendimentoId)}
                        >
                          {/* Left quick mover button (hover-only) */}
                          {hasPrev && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); moverEtapa(ultima.id, atendimento.etapa, "prev"); }}
                              disabled={isSaving}
                              className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-5 rounded-md bg-background/80 hover:bg-background text-muted-foreground hover:text-primary border border-muted opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-sm z-10"
                              title={`Mover para ${ROTULOS_ETAPA_ATENDIMENTO[ETAPA_ATENDIMENTO[currentIndex - 1]]}`}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                          )}

                          {/* Right quick mover button (hover-only) */}
                          {hasNext && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); moverEtapa(ultima.id, atendimento.etapa, "next"); }}
                              disabled={isSaving}
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-5 rounded-md bg-background/80 hover:bg-background text-muted-foreground hover:text-primary border border-muted opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-sm z-10"
                              title={`Mover para ${ROTULOS_ETAPA_ATENDIMENTO[ETAPA_ATENDIMENTO[currentIndex + 1]]}`}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          )}

                          <CardHeader className="p-3 pb-1.5 pr-8 pl-8 md:pl-7 md:pr-7" onClick={(e) => e.stopPropagation()}>
                            <CardTitle className="text-sm font-semibold">
                              <Link 
                                href={`/cadastros/${atendimento.cadastroId}`} 
                                className="text-foreground hover:text-primary hover:underline transition-colors block whitespace-normal break-words"
                              >
                                {nomePorCadastro.get(atendimento.cadastroId) ?? "Cadastro"}
                              </Link>
                            </CardTitle>
                          </CardHeader>
                          
                          <CardContent className="flex flex-col gap-2 p-3 pt-0 pr-8 pl-8 md:pl-7 md:pr-7 relative">
                            {isSaving && (
                              <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center z-20">
                                <Loader2 className="h-5 w-5 text-primary animate-spin" />
                              </div>
                            )}

                            <p className="text-xs text-muted-foreground/90 line-clamp-3 leading-relaxed">
                              {ultima.descricao}
                            </p>
                            
                            {atendimento.valorEstimado > 0 && (
                              <div className="text-xs font-bold text-foreground bg-muted/40 px-2 py-0.5 rounded border dark:border-white/5 w-fit">
                                R${" "}
                                {atendimento.valorEstimado.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                })}
                              </div>
                            )}
                            
                            <div className="border-t border-muted/20 pt-2 mt-1 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                              <EtapaInteracaoSelect id={ultima.id} etapa={atendimento.etapa} />
                              
                              <ReagendarInteracao
                                interacaoId={ultima.id}
                                cadastroId={atendimento.cadastroId}
                                dataReagendamento={ultima.dataReagendamento ?? ""}
                              />
                            </div>

                            {atendimento.interacoes.length > 1 && (
                              <div className="text-[10px] text-muted-foreground/60 text-right font-medium mt-1">
                                {atendimento.interacoes.length} registros
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ==================== TABULAR LIST VIEW ==================== */
        <div className="bg-card rounded-2xl border border-muted shadow-sm overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Etapa Atual</th>
                  <th className="px-6 py-4">Última Interação</th>
                  <th className="px-6 py-4">Valor Estimado</th>
                  <th className="px-6 py-4">Agenda / Retorno</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/30">
                {atendimentosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="h-6 w-6 text-muted-foreground/60" />
                        <p className="font-semibold text-xs">Nenhum atendimento correspondente encontrado.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  atendimentosFiltrados.map((atendimento) => {
                    const ultima = atendimento.interacoes[atendimento.interacoes.length - 1];
                    const cor = CORES_ETAPA[atendimento.etapa] || CORES_ETAPA.FINALIZADO;
                    const isSaving = movendoCardId === ultima.id;

                    return (
                      <tr 
                        key={atendimento.atendimentoId} 
                        className={`hover:bg-muted/10 transition-colors relative cursor-pointer ${isSaving ? "opacity-60" : ""}`}
                        onClick={() => setSelectedAtendimentoId(atendimento.atendimentoId)}
                      >
                        {/* Client Name */}
                        <td className="px-6 py-4 font-semibold" onClick={(e) => e.stopPropagation()}>
                          <Link 
                            href={`/cadastros/${atendimento.cadastroId}`} 
                            className="text-foreground hover:text-primary hover:underline transition-colors font-bold"
                          >
                            {nomePorCadastro.get(atendimento.cadastroId) ?? "Cadastro"}
                          </Link>
                          {atendimento.interacoes.length > 1 && (
                            <span className="ml-2 text-[10px] bg-muted/60 text-muted-foreground border px-1.5 py-0.5 rounded font-normal">
                              {atendimento.interacoes.length} reg.
                            </span>
                          )}
                        </td>

                        {/* Stage Badge */}
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cor.bg} ${cor.text} ${cor.border}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${cor.indicator}`} />
                            {ROTULOS_ETAPA_ATENDIMENTO[atendimento.etapa]}
                          </span>
                        </td>

                        {/* Description */}
                        <td className="px-6 py-4 text-xs text-muted-foreground max-w-sm">
                          <p className="line-clamp-2 leading-relaxed">{ultima.descricao}</p>
                        </td>

                        {/* Estimated Value */}
                        <td className="px-6 py-4 font-bold text-foreground">
                          {atendimento.valorEstimado > 0 ? (
                            <span>R$ {atendimento.valorEstimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          ) : (
                            <span className="text-muted-foreground/30 font-normal">-</span>
                          )}
                        </td>

                        {/* Rescheduling Info */}
                        <td className="px-6 py-4 text-xs" onClick={(e) => e.stopPropagation()}>
                          <ReagendarInteracao
                            interacaoId={ultima.id}
                            cadastroId={atendimento.cadastroId}
                            dataReagendamento={ultima.dataReagendamento ?? ""}
                          />
                        </td>

                        {/* Actions column */}
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs font-semibold"
                              onClick={() => setSelectedAtendimentoId(atendimento.atendimentoId)}
                            >
                              Ver Histórico
                            </Button>
                            <div className="inline-block text-left w-36">
                              <EtapaInteracaoSelect id={ultima.id} etapa={atendimento.etapa} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 text-center border-t bg-muted/20 text-xs text-muted-foreground font-medium">
            Exibindo {atendimentosFiltrados.length} atendimentos filtrados.
          </div>
        </div>
      )}

      {/* ==================== INTERACTION HISTORY DIALOG ==================== */}
      <Dialog 
        open={selectedAtendimentoId !== null} 
        onOpenChange={(open) => {
          if (!open) setSelectedAtendimentoId(null);
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl p-6 glass-card border border-white/20 dark:border-white/10 shadow-2xl">
          {atendimentoSelecionado && (
            <div className="flex flex-col gap-5">
              <DialogHeader className="border-b pb-4 border-muted/30">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    <span>{nomePorCadastro.get(atendimentoSelecionado.cadastroId) || "Atendimento"}</span>
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-1.5">
                  Visualização do histórico comercial e registro de novas conversas/negociações.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-2">
                {/* Historical records - Left Column (7 cols) */}
                <div className="md:col-span-7 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-muted-foreground/60" />
                      <span>Linha do Tempo ({atendimentoSelecionado.interacoes.length})</span>
                    </h3>
                  </div>
                  
                  <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-2 scrollbar-thin">
                    {atendimentoSelecionado.interacoes.map((interacao, idx) => (
                      <div 
                        key={interacao.id} 
                        className="p-4 rounded-xl border border-muted/70 bg-muted/20 dark:bg-muted/10 relative group hover:bg-muted/30 dark:hover:bg-muted/20 transition-all duration-150"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 border-b border-muted/10 pb-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted/60 dark:bg-muted/30 border border-muted/10">
                              {ROTULOS_TIPO_INTERACAO[interacao.tipo]}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 border-primary/20 bg-primary/5 text-primary">
                              {ROTULOS_ETAPA_ATENDIMENTO[interacao.etapa]}
                            </Badge>
                          </div>
                          
                          <span className="text-[10px] text-muted-foreground/80 font-medium">
                            {new Date(interacao.data).toLocaleString("pt-BR", { 
                              dateStyle: "short", 
                              timeStyle: "short" 
                            })}
                          </span>
                        </div>

                        <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed mt-1 font-medium select-text">
                          {interacao.descricao}
                        </p>
                        
                        {interacao.valorEstimado > 0 && (
                          <div className="mt-2 text-[11px] font-bold text-foreground bg-background border px-2 py-0.5 rounded dark:border-white/5 w-fit">
                            R$ {interacao.valorEstimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </div>
                        )}
                        
                        <div className="mt-3 pt-2 border-t border-muted/15 flex items-center gap-3">
                          <ReagendarInteracao
                            interacaoId={interacao.id}
                            cadastroId={atendimentoSelecionado.cadastroId}
                            dataReagendamento={interacao.dataReagendamento ?? ""}
                          />
                        </div>
                        
                        {interacao.usuarioNome && (
                          <div className="text-[9px] text-muted-foreground/50 text-right mt-1 font-semibold">
                            Registrado por: {interacao.usuarioNome}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Interaction Form - Right Column (5 cols) */}
                <div className="md:col-span-5 flex flex-col gap-4 border-t md:border-t-0 md:border-l border-muted/40 pt-5 md:pt-0 md:pl-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Plus className="h-4 w-4 text-primary" />
                    <span>Nova Ação / Registro</span>
                  </h3>
                  
                  <div className="p-1 rounded-xl bg-background/30 max-h-[50vh] overflow-y-auto pr-1 scrollbar-thin">
                    <InteracaoForm
                      cadastroId={atendimentoSelecionado.cadastroId}
                      etapaAtual={atendimentoSelecionado.etapa}
                      valorEstimadoAtual={atendimentoSelecionado.valorEstimado}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
