"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, ExternalLink, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NovoAgendamentoDialog } from "@/components/agendamentos/novo-agendamento-dialog";
import { buscarEventosGoogle } from "@/server/google-calendar";
import type { EventoGoogle } from "@/lib/google-calendar";
import { hojeISO } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { type Cadastro } from "@/lib/types";

interface AgendamentosClientProps {
  cadastros: Cadastro[];
  /** E-mail da conta Google conectada em Configurações (null = não conectada). */
  emailGoogle: string | null;
}

const DIAS_SEMANA = ["DOM.", "SEG.", "TER.", "QUA.", "QUI.", "SEX.", "SÁB."];
const MAX_EVENTOS_NA_CELULA = 3;

// Mesmas cores da paleta do Google Calendar (Pavão, Banana, Manjericão, Lavanda),
// e as mesmas usadas nos eventos gravados por src/lib/google-calendar.ts.
const CORES_ORIGEM: Record<EventoGoogle["origem"], string> = {
  AGENDAMENTO: "#039be5",
  ORCAMENTO: "#f6bf26",
  PEDIDO: "#0b8043",
  GOOGLE: "#7986cb",
};

function chaveDia(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Semanas (domingo a sábado) que cobrem o mês — 4 a 6, como no Google. */
function diasDaGrade(ano: number, mes: number) {
  const primeiro = new Date(Date.UTC(ano, mes, 1));
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0));
  const inicio = new Date(primeiro.getTime() - primeiro.getUTCDay() * 86_400_000);
  const semanas = Math.ceil((primeiro.getUTCDay() + ultimo.getUTCDate()) / 7);
  return Array.from({ length: semanas * 7 }, (_, i) => {
    const d = new Date(inicio.getTime() + i * 86_400_000);
    return { chave: chaveDia(d), dia: d.getUTCDate(), doMes: d.getUTCMonth() === mes };
  });
}

const ROTULOS_ABRIR: Record<EventoGoogle["origem"], string> = {
  AGENDAMENTO: "Abrir cliente",
  ORCAMENTO: "Abrir orçamento",
  PEDIDO: "Abrir pedido",
  GOOGLE: "Abrir no Google",
};

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function medida(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/** Balão que abre ao clicar no evento, como o do Google Calendar. */
function BalaoEvento({ evento, onReagendar }: { evento: EventoGoogle; onReagendar: () => void }) {
  const cor = CORES_ORIGEM[evento.origem];
  const data = new Date(`${evento.dia}T12:00:00Z`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const interno = evento.link.startsWith("/");

  return (
    <PopoverContent
      // O balão fica num portal, mas o React ainda propaga os eventos até o
      // quadrado do dia: sem isso, clicar no balão abriria o modal de agendar.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded" style={{ backgroundColor: cor }} />
          <div className="min-w-0">
            <p className="text-base leading-snug font-medium break-words">{evento.titulo}</p>
            <p className="text-xs text-muted-foreground first-letter:uppercase">
              {data}
              {evento.hora && ` · ${evento.hora}`}
            </p>
          </div>
        </div>
        <PopoverClose
          render={<Button variant="ghost" size="icon-sm" className="-mt-1 -mr-1 shrink-0 rounded-full" aria-label="Fechar" />}
        >
          <X className="h-4 w-4" />
        </PopoverClose>
      </div>

      {evento.valor !== null && (
        <p className="pl-6.5 text-sm">
          <span className="text-muted-foreground">{evento.itens.length > 0 ? "Total " : "Valor estimado "}</span>
          <span className="font-semibold">{moeda(evento.valor)}</span>
        </p>
      )}

      {evento.itens.length > 0 && (
        <ul className="ml-6.5 flex max-h-48 flex-col gap-1.5 overflow-y-auto border-t pt-2 text-xs">
          {evento.itens.map((item, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="min-w-0">
                <span className="text-muted-foreground">{medida(item.quantidade)}× </span>
                <span className="font-medium">{item.nome}</span>
                {item.comprimento > 0 && item.largura > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({medida(item.comprimento)} × {medida(item.largura)})
                  </span>
                )}
              </span>
              <span className="shrink-0 tabular-nums">{moeda(item.quantidade * item.precoUnitario)}</span>
            </li>
          ))}
        </ul>
      )}

      {evento.descricao && (
        <p className="pl-6.5 text-xs whitespace-pre-line text-muted-foreground line-clamp-6">{evento.descricao}</p>
      )}

      <div className="flex items-center justify-end gap-1">
        {(evento.origem === "ORCAMENTO" || evento.origem === "PEDIDO") && evento.cadastroId && (
          <Button variant="outline" size="sm" onClick={onReagendar} className="mr-auto gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            Reagendar
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={
            interno ? (
              <Link href={evento.link} />
            ) : (
              <a href={evento.link} target="_blank" rel="noreferrer" />
            )
          }
          className="gap-1.5 text-primary"
        >
          {ROTULOS_ABRIR[evento.origem]}
          {!interno && <ExternalLink className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </PopoverContent>
  );
}

function ChipEvento({ evento, onReagendar }: { evento: EventoGoogle; onReagendar: (evento: EventoGoogle) => void }) {
  const cor = CORES_ORIGEM[evento.origem];
  const [aberto, setAberto] = useState(false);
  // Como no Google: dia inteiro é uma faixa preenchida; com horário, bolinha + hora.
  const gatilho = !evento.hora ? (
    <button
      type="button"
      className="block w-full truncate rounded px-1.5 py-px text-left text-[11px] font-medium text-white hover:brightness-95"
      style={{ backgroundColor: cor }}
    />
  ) : (
    <button
      type="button"
      className="flex w-full items-center gap-1 truncate rounded px-1 py-px text-left text-[11px] text-foreground hover:bg-muted data-popup-open:bg-muted"
    />
  );

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger render={gatilho} onClick={(e) => e.stopPropagation()} title={evento.titulo}>
        {!evento.hora ? (
          evento.titulo
        ) : (
          <>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cor }} />
            <span className="shrink-0 text-muted-foreground">{evento.hora}</span>
            <span className="truncate font-medium">{evento.titulo}</span>
          </>
        )}
      </PopoverTrigger>
      <BalaoEvento
        evento={evento}
        onReagendar={() => {
          setAberto(false);
          onReagendar(evento);
        }}
      />
    </Popover>
  );
}

export function AgendamentosClient({ cadastros, emailGoogle }: AgendamentosClientProps) {
  const hoje = hojeISO();
  const [ano, setAno] = useState(() => Number(hoje.slice(0, 4)));
  const [mes, setMes] = useState(() => Number(hoje.slice(5, 7)) - 1);
  const [eventos, setEventos] = useState<EventoGoogle[]>([]);
  /** Orçamento/pedido cujo retorno está sendo reagendado pelo balão. */
  const [reagendando, setReagendando] = useState<EventoGoogle | null>(null);
  /** Dia clicado: abre o modal de novo agendamento já com essa data. */
  const [diaClicado, setDiaClicado] = useState<string | null>(null);
  // Muda a cada agendamento criado para buscar de novo os eventos do Google.
  const [versao, setVersao] = useState(0);
  const [carregando, startTransition] = useTransition();

  const grade = useMemo(() => diasDaGrade(ano, mes), [ano, mes]);

  useEffect(() => {
    if (!emailGoogle) return;
    const timeMin = new Date(`${grade[0].chave}T00:00:00-03:00`).toISOString();
    const timeMax = new Date(`${grade[grade.length - 1].chave}T23:59:59-03:00`).toISOString();
    startTransition(async () => {
      try {
        setEventos(await buscarEventosGoogle(timeMin, timeMax));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao carregar a agenda do Google.");
      }
    });
  }, [emailGoogle, grade, versao]);

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoGoogle[]>();
    for (const ev of eventos) {
      const lista = mapa.get(ev.dia) ?? [];
      lista.push(ev);
      mapa.set(ev.dia, lista);
    }
    // Dia inteiro primeiro, depois por horário (igual ao Google).
    for (const lista of mapa.values()) lista.sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));
    return mapa;
  }, [eventos]);

  function mudarMes(delta: number) {
    const d = new Date(Date.UTC(ano, mes + delta, 1));
    setAno(d.getUTCFullYear());
    setMes(d.getUTCMonth());
  }

  function irParaHoje() {
    setAno(Number(hoje.slice(0, 4)));
    setMes(Number(hoje.slice(5, 7)) - 1);
  }

  const tituloMes = new Date(Date.UTC(ano, mes, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  if (!emailGoogle) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.7rem]">Agenda de contatos</h1>
        <div className="superficie p-6 text-sm text-muted-foreground">
          Nenhuma conta Google conectada.{" "}
          <Link href="/configuracoes" className="font-medium text-primary underline-offset-4 hover:underline">
            Conecte em Configurações
          </Link>{" "}
          para ver a agenda aqui.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Barra no estilo do Google Calendar: Hoje  <  >  mês */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Button variant="outline" className="rounded-full px-4" onClick={irParaHoje}>
          Hoje
        </Button>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => mudarMes(-1)} aria-label="Mês anterior">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => mudarMes(1)} aria-label="Próximo mês">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <h1 className="text-xl font-normal capitalize text-foreground sm:text-[1.4rem]">{tituloMes}</h1>
        {carregando && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<a href="https://calendar.google.com/calendar/r" target="_blank" rel="noreferrer" />}
          className="ml-auto gap-1.5 text-muted-foreground"
        >
          <ExternalLink className="h-4 w-4" />
          <span className="hidden sm:inline">Abrir no Google</span>
        </Button>
      </div>

      <div className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border bg-card">
        <div className="grid grid-cols-7 border-b">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="py-1.5 text-center text-[11px] font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        <div className="grid flex-1 grid-cols-7 auto-rows-fr">
          {grade.map(({ chave, dia, doMes }, i) => {
            const doDia = eventosPorDia.get(chave) ?? [];
            const ehHoje = chave === hoje;
            const restantes = doDia.length - MAX_EVENTOS_NA_CELULA;
            return (
              <div
                key={chave}
                role="button"
                tabIndex={0}
                aria-label={`Agendar em ${chave.split("-").reverse().join("/")}`}
                onClick={() => setDiaClicado(chave)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDiaClicado(chave);
                  }
                }}
                className={cn(
                  "flex min-h-20 cursor-pointer flex-col gap-px overflow-hidden border-b border-r px-0.5 pb-1 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:min-h-28 sm:px-1",
                  (i + 1) % 7 === 0 && "border-r-0",
                  i >= grade.length - 7 && "border-b-0"
                )}
              >
                <div className="flex justify-center pt-1">
                  <span
                    className={cn(
                      "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium",
                      ehHoje && "bg-[#1a73e8] text-white",
                      !ehHoje && !doMes && "text-muted-foreground/60"
                    )}
                  >
                    {dia === 1 && !ehHoje
                      ? new Date(`${chave}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" })
                      : dia}
                  </span>
                </div>

                {/* No celular só cabem bolinhas; do tablet para cima, os eventos. */}
                <div className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                  {doDia.slice(0, 4).map((ev) => (
                    <span key={ev.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CORES_ORIGEM[ev.origem] }} />
                  ))}
                </div>
                <div className="hidden flex-col gap-px sm:flex">
                  {doDia.slice(0, MAX_EVENTOS_NA_CELULA).map((ev) => (
                    <ChipEvento key={ev.id} evento={ev} onReagendar={setReagendando} />
                  ))}
                  {restantes > 0 && (
                    <span className="px-1 text-[11px] font-medium text-muted-foreground">
                      Mais {restantes}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {diaClicado && (
        <NovoAgendamentoDialog
          // key: remonta a cada dia clicado, para o formulário já nascer com a data.
          key={diaClicado}
          cadastros={cadastros}
          defaultDateKey={diaClicado}
          hideTrigger
          open
          onOpenChange={(aberto) => {
            if (!aberto) setDiaClicado(null);
          }}
          onCriado={() => setVersao((v) => v + 1)}
        />
      )}
      {reagendando && (
        <NovoAgendamentoDialog
          key={reagendando.id}
          cadastros={cadastros}
          titulo="Reagendar retorno"
          defaultCadastroId={reagendando.cadastroId ?? undefined}
          defaultTipo="LIGACAO"
          // Orçamento em aberto continua na proposta; pedido fechado vira pós-venda.
          defaultEtapa={reagendando.origem === "ORCAMENTO" ? "PROPOSTA" : "AGUARDANDO_RETORNO"}
          defaultDescricao={`RETORNO DO ${reagendando.origem === "ORCAMENTO" ? "ORÇAMENTO" : "PEDIDO"} #${reagendando.codigo ?? ""}`}
          hideTrigger
          open
          onOpenChange={(aberto) => {
            if (!aberto) setReagendando(null);
          }}
          onCriado={() => setVersao((v) => v + 1)}
        />
      )}
    </div>
  );
}
