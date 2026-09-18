"use client";

import { useState, useMemo } from "react";
import { User, FileText, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CrmCalendar } from "@/components/crm/crm-calendar";
import { InteracaoForm } from "@/components/crm/interacao-form";
import { ReagendarInteracao } from "@/components/crm/reagendar-interacao";
import { type Atendimento, type Cadastro, type Pedido } from "@/lib/types";
import { ROTULOS_ETAPA_ATENDIMENTO, ROTULOS_TIPO_INTERACAO } from "@/lib/rotulos";

interface AgendamentosClientProps {
  atendimentos: Atendimento[];
  cadastros: Cadastro[];
  pedidos: Pedido[];
}

export function AgendamentosClient({ atendimentos, cadastros, pedidos }: AgendamentosClientProps) {
  const [selectedAtendimentoId, setSelectedAtendimentoId] = useState<string | null>(null);

  const nomePorCadastro = useMemo(() => {
    return new Map(cadastros.map((c) => [c.id, c.nome]));
  }, [cadastros]);

  const atendimentoSelecionado = useMemo(() => {
    return atendimentos.find((a) => a.atendimentoId === selectedAtendimentoId) || null;
  }, [atendimentos, selectedAtendimentoId]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.7rem]">
            Agenda de contatos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Veja os agendamentos do mês, os orçamentos do dia e o que virou pedido.
          </p>
        </div>
      </div>

      {/* Main Google Calendar View */}
      <CrmCalendar
        atendimentos={atendimentos}
        cadastros={cadastros}
        pedidos={pedidos}
        onSelectAtendimento={(atendimentoId) => setSelectedAtendimentoId(atendimentoId)}
      />

      {/* Interaction History Modal */}
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
                {/* Historical records - Left Column */}
                <div className="md:col-span-7 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-muted-foreground/60" />
                      <span>Linha do Tempo ({atendimentoSelecionado.interacoes.length})</span>
                    </h3>
                  </div>

                  <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-2 scrollbar-thin">
                    {atendimentoSelecionado.interacoes.map((interacao) => (
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
                              timeStyle: "short",
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

                {/* Interaction Form - Right Column */}
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
