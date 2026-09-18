"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Phone,
  MessageCircle,
  MapPin,
  FileText,
  User,
  ArrowUpRight,
  Search,
  Receipt,
  CheckCircle2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReagendarInteracao } from "@/components/crm/reagendar-interacao";
import { NovoAgendamentoDialog } from "@/components/agendamentos/novo-agendamento-dialog";
import {
  type Atendimento,
  type Cadastro,
  type Interacao,
  type Pedido,
  type TipoInteracao,
} from "@/lib/types";
import { ROTULOS_ETAPA_ATENDIMENTO, ROTULOS_TIPO_INTERACAO } from "@/lib/rotulos";
import { temHorario } from "@/lib/datetime";
import { formatarCodigo } from "@/lib/codigo";

interface CrmCalendarProps {
  atendimentos: Atendimento[];
  cadastros: Cadastro[];
  pedidos?: Pedido[];
  onSelectAtendimento: (atendimentoId: string) => void;
}

/**
 * A cor do evento na agenda vem da situação dele, não do tipo de contato:
 * - PEDIDO (verde): orçamento que já foi transformado em pedido;
 * - ORCAMENTO (roxo): orçamento ainda aberto, no dia em que foi feito;
 * - FUTURO (laranja): agendamento de hoje em diante;
 * - PASSADO (cinza): agendamento cuja data já passou.
 */
type CategoriaEvento = "PEDIDO" | "ORCAMENTO" | "FUTURO" | "PASSADO";

interface EventoBase {
  id: string;
  titulo: string;
  cadastroId: string;
  categoria: CategoriaEvento;
  dateKey: string; // YYYY-MM-DD
  horaStr: string; // "14:30" ou ""
  textoBusca: string;
}

interface EventoInteracao extends EventoBase {
  origem: "INTERACAO";
  interacao: Interacao;
  atendimento: Atendimento;
}

interface EventoPedido extends EventoBase {
  origem: "PEDIDO";
  pedido: Pedido;
}

type EventoAgendado = EventoInteracao | EventoPedido;

const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const ICONES_TIPO: Record<TipoInteracao, typeof Phone> = {
  LIGACAO: Phone,
  WHATSAPP: MessageCircle,
  VISITA: MapPin,
  NOTA: FileText,
};

const CORES_CATEGORIA: Record<
  CategoriaEvento,
  { bg: string; text: string; border: string; dot: string }
> = {
  PEDIDO: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20 hover:bg-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  ORCAMENTO: {
    bg: "bg-purple-500/10 dark:bg-purple-500/20 hover:bg-purple-500/20",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500/30",
    dot: "bg-purple-500",
  },
  FUTURO: {
    bg: "bg-orange-500/10 dark:bg-orange-500/20 hover:bg-orange-500/20",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-500/30",
    dot: "bg-orange-500",
  },
  PASSADO: {
    bg: "bg-slate-500/10 dark:bg-slate-500/20 hover:bg-slate-500/20",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-500/30",
    dot: "bg-slate-400",
  },
};

const ROTULOS_CATEGORIA: Record<CategoriaEvento, string> = {
  PEDIDO: "Orçamento virou pedido",
  ORCAMENTO: "Orçamento do dia",
  FUTURO: "Agendamento futuro",
  PASSADO: "Agendamento passado",
};

const ORDEM_LEGENDA: CategoriaEvento[] = ["PEDIDO", "ORCAMENTO", "FUTURO", "PASSADO"];

// Texto gravado por converterEmPedido (src/server/pedidos.ts).
const REGEX_NOTA_CONVERSAO = /^ORÇAMENTO #(\d+) TRANSFORMADO EM PEDIDO$/;

function formatarYYYYMMDD(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function iconeDoEvento(ev: EventoAgendado) {
  if (ev.origem === "PEDIDO") {
    return ev.pedido.status === "PEDIDO" ? CheckCircle2 : Receipt;
  }
  return ICONES_TIPO[ev.interacao.tipo] || FileText;
}

export function CrmCalendar({
  atendimentos,
  cadastros,
  pedidos = [],
  onSelectAtendimento,
}: CrmCalendarProps) {
  const hojeDate = useMemo(() => new Date(), []);
  const hojeKey = useMemo(() => formatarYYYYMMDD(hojeDate), [hojeDate]);

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  // null = painel do dia fechado; ele só abre quando um dia é clicado.
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  // No celular/tablet o painel abre abaixo do calendário: rola até ele.
  useEffect(() => {
    if (!selectedDateKey || window.matchMedia("(min-width: 1024px)").matches) return;
    painelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedDateKey]);
  const [filtroTexto, setFiltroTexto] = useState("");

  const nomePorCadastro = useMemo(() => {
    return new Map(cadastros.map((c) => [c.id, c.nome]));
  }, [cadastros]);

  // Indexa agendamentos (interações do CRM) e orçamentos/pedidos como eventos
  const todosEventos = useMemo(() => {
    const lista: EventoAgendado[] = [];
    const numerosPedidos = new Set(pedidos.map((p) => p.numero));

    for (const atendimento of atendimentos) {
      const nomeCliente = nomePorCadastro.get(atendimento.cadastroId) || "Cliente";

      for (const interacao of atendimento.interacoes) {
        // A conversão em pedido grava uma nota no CRM além de mudar o pedido;
        // o pedido já aparece na agenda, então a nota repetiria o mesmo evento.
        const conversao = REGEX_NOTA_CONVERSAO.exec(interacao.descricao);
        if (conversao && numerosPedidos.has(Number(conversao[1]))) continue;

        let dateKey = "";
        let horaStr = "";

        if (interacao.dataReagendamento && interacao.dataReagendamento.trim() !== "") {
          const val = interacao.dataReagendamento.trim();
          if (temHorario(val)) {
            const [dataPart, horaPart] = val.split("T");
            dateKey = dataPart;
            horaStr = horaPart ? horaPart.slice(0, 5) : "";
          } else {
            dateKey = val;
          }
        } else if (interacao.data) {
          const d = new Date(interacao.data);
          if (!Number.isNaN(d.getTime())) {
            dateKey = formatarYYYYMMDD(d);
            horaStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          }
        }

        if (!dateKey) continue;

        // Etapa GANHO é o registro que a conversão do orçamento em pedido cria.
        const categoria: CategoriaEvento =
          interacao.etapa === "GANHO" ? "PEDIDO" : dateKey >= hojeKey ? "FUTURO" : "PASSADO";

        lista.push({
          origem: "INTERACAO",
          id: interacao.id,
          interacao,
          atendimento,
          titulo: nomeCliente,
          cadastroId: atendimento.cadastroId,
          categoria,
          dateKey,
          horaStr,
          textoBusca: [
            nomeCliente,
            interacao.descricao,
            ROTULOS_TIPO_INTERACAO[interacao.tipo],
            ROTULOS_ETAPA_ATENDIMENTO[interacao.etapa],
            ROTULOS_CATEGORIA[categoria],
          ]
            .join(" ")
            .toLowerCase(),
        });
      }
    }

    for (const pedido of pedidos) {
      if (!pedido.createdAt) continue;
      const d = new Date(pedido.createdAt);
      if (Number.isNaN(d.getTime())) continue;

      const codigo = formatarCodigo(pedido.numero);
      const categoria: CategoriaEvento = pedido.status === "PEDIDO" ? "PEDIDO" : "ORCAMENTO";

      lista.push({
        origem: "PEDIDO",
        id: `pedido-${pedido.id}`,
        pedido,
        titulo: `#${codigo} ${pedido.cadastroNome}`,
        cadastroId: pedido.cadastroId,
        categoria,
        dateKey: formatarYYYYMMDD(d),
        horaStr: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        textoBusca: [codigo, pedido.cadastroNome, ROTULOS_CATEGORIA[categoria]]
          .join(" ")
          .toLowerCase(),
      });
    }

    return lista;
  }, [atendimentos, nomePorCadastro, pedidos, hojeKey]);

  // Filter events based on search query
  const eventosFiltrados = useMemo(() => {
    if (!filtroTexto.trim()) return todosEventos;
    const termo = filtroTexto.toLowerCase().trim();
    return todosEventos.filter((e) => e.textoBusca.includes(termo));
  }, [todosEventos, filtroTexto]);

  // Map events by dateKey for fast lookup
  const eventosPorData = useMemo(() => {
    const mapa = new Map<string, EventoAgendado[]>();
    for (const ev of eventosFiltrados) {
      const arr = mapa.get(ev.dateKey) || [];
      arr.push(ev);
      mapa.set(ev.dateKey, arr);
    }
    // Dia inteiro (sem horário) primeiro, depois em ordem de horário.
    for (const arr of mapa.values()) {
      arr.sort((a, b) => a.horaStr.localeCompare(b.horaStr));
    }
    return mapa;
  }, [eventosFiltrados]);

  // Month grid calculation
  const calendarCells = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDaysInMonth = new Date(year, month, 0).getDate();

    const cells: {
      day: number;
      monthOffset: -1 | 0 | 1;
      dateKey: string;
      isToday: boolean;
      isCurrentMonth: boolean;
    }[] = [];

    // Previous month padding
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevDaysInMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const key = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({
        day: d,
        monthOffset: -1,
        dateKey: key,
        isToday: key === hojeKey,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({
        day: d,
        monthOffset: 0,
        dateKey: key,
        isToday: key === hojeKey,
        isCurrentMonth: true,
      });
    }

    // Next month padding to fill grid to 35 or 42 cells
    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const key = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({
        day: d,
        monthOffset: 1,
        dateKey: key,
        isToday: key === hojeKey,
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [currentDate, hojeKey]);

  // Navigation handlers
  function mesAnterior() {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function mesSeguinte() {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  function irParaHoje() {
    setCurrentDate(new Date());
  }

  // Clicar no dia já aberto fecha o painel.
  function alternarDia(dateKey: string) {
    setSelectedDateKey((atual) => (atual === dateKey ? null : dateKey));
  }

  // Events on the selected day
  const agendamentosDiaSelecionado = useMemo(() => {
    if (!selectedDateKey) return [];
    return eventosPorData.get(selectedDateKey) || [];
  }, [eventosPorData, selectedDateKey]);

  // Format label for selected date header
  const labelDiaSelecionado = useMemo(() => {
    if (!selectedDateKey) return "";
    const [y, m, d] = selectedDateKey.split("-").map(Number);
    if (!y || !m || !d) return "";
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, [selectedDateKey]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Top Header: Controls & Search */}
      <div className="superficie flex flex-col gap-3 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Month Title and Nav */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border dark:border-white/5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={mesAnterior}
                title="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs font-bold px-3 rounded-lg"
                onClick={irParaHoje}
              >
                Hoje
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={mesSeguinte}
                title="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <h2 className="text-lg md:text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              <span className="capitalize">
                {MESES[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
            </h2>
          </div>

          {/* Right side: Search */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative min-w-[200px] flex-1 md:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filtrar agendamentos..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-background/50 border-muted focus:bg-background w-full"
              />
            </div>
          </div>
        </div>

        {/* Legenda das cores */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-muted/40 pt-2.5">
          {ORDEM_LEGENDA.map((categoria) => (
            <span
              key={categoria}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"
            >
              <span
                aria-hidden
                className={`h-2.5 w-2.5 rounded-full ${CORES_CATEGORIA[categoria].dot}`}
              />
              {ROTULOS_CATEGORIA[categoria]}
            </span>
          ))}
        </div>
      </div>

      {/* Grid and Details Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Month Calendar — largura total até um dia ser aberto */}
        <div
          className={`${
            selectedDateKey ? "lg:col-span-8" : "lg:col-span-12"
          } superficie flex flex-col overflow-hidden`}
        >
          {/* Days of Week Header */}
          <div className="grid grid-cols-7 border-b border-muted/40 bg-muted/20 text-center py-2.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {DIAS_DA_SEMANA.map((dia, idx) => (
              <div key={dia} className={idx === 0 || idx === 6 ? "text-amber-500/80" : ""}>
                {dia}
              </div>
            ))}
          </div>

          {/* Month Day Cells */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-muted/30 bg-background/40">
            {calendarCells.map((cell) => {
              const items = eventosPorData.get(cell.dateKey) || [];
              const isSelected = cell.dateKey === selectedDateKey;

              return (
                <div
                  key={cell.dateKey}
                  onClick={() => alternarDia(cell.dateKey)}
                  className={`min-h-[90px] md:min-h-[105px] p-1 md:p-1.5 min-w-0 transition-all duration-150 cursor-pointer flex flex-col gap-1 relative group ${
                    !cell.isCurrentMonth ? "bg-muted/10 opacity-45" : "bg-card hover:bg-muted/20"
                  } ${
                    isSelected
                      ? "ring-2 ring-primary ring-inset bg-primary/5 dark:bg-primary/10 shadow-sm z-10"
                      : ""
                  }`}
                >
                  {/* Cell Header: Day Number */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold h-6 w-6 rounded-full flex items-center justify-center transition-all ${
                        cell.isToday
                          ? "bg-primary text-primary-foreground font-bold shadow-sm"
                          : isSelected
                          ? "bg-primary/20 text-primary font-bold"
                          : cell.isCurrentMonth
                          ? "text-foreground group-hover:text-primary"
                          : "text-muted-foreground/60"
                      }`}
                    >
                      {cell.day}
                    </span>

                    {items.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {items.length}
                      </span>
                    )}
                  </div>

                  {/* Scheduled items preview inside day cell */}
                  <div className="flex flex-col gap-1 mt-0.5">
                    {items.slice(0, 3).map((ev) => {
                      const Icone = iconeDoEvento(ev);
                      const cor = CORES_CATEGORIA[ev.categoria];
                      const detalhe =
                        ev.origem === "PEDIDO"
                          ? ROTULOS_CATEGORIA[ev.categoria]
                          : ev.interacao.descricao;

                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDateKey(cell.dateKey);
                            if (ev.origem === "INTERACAO") {
                              onSelectAtendimento(ev.atendimento.atendimentoId);
                            }
                          }}
                          className={`text-[10px] md:text-[11px] leading-tight p-1 rounded border ${cor.bg} ${cor.text} ${cor.border} flex items-start gap-1 font-medium hover:scale-[1.02] transition-transform shadow-2xs`}
                          title={`${ev.horaStr ? ev.horaStr + " - " : ""}${ev.titulo}: ${detalhe}`}
                        >
                          <Icone className="hidden sm:block h-3 w-3 shrink-0 mt-px" />
                          {/* Nome inteiro: quebra linha em vez de cortar com "..." */}
                          <span className="flex-1 min-w-0 font-semibold break-words [overflow-wrap:anywhere]">
                            {ev.titulo}
                          </span>
                          {ev.horaStr && (
                            <span className="hidden sm:block text-[9px] opacity-80 shrink-0 font-mono mt-px">
                              {ev.horaStr}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {items.length > 3 && (
                      <div className="text-[9px] font-bold text-muted-foreground/80 pl-1 text-center py-0.5 bg-muted/40 rounded border border-muted/20">
                        + {items.length - 3} agendamentos
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: painel do dia, só aparece depois de clicar num dia */}
        {selectedDateKey && (
        <div ref={painelRef} className="lg:col-span-4 flex flex-col gap-4 animate-fade-in">
          <Card className="superficie h-full overflow-hidden flex flex-col">
            <CardHeader className="p-4 bg-muted/20 border-b border-muted/40 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold capitalize flex items-center gap-2 text-foreground">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>Agendamentos do Dia</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs font-bold">
                    {agendamentosDiaSelecionado.length} registros
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg"
                    onClick={() => setSelectedDateKey(null)}
                    title="Fechar"
                    aria-label="Fechar agendamentos do dia"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground capitalize font-medium">
                  {labelDiaSelecionado}
                </p>
                <NovoAgendamentoDialog
                  cadastros={cadastros}
                  defaultDateKey={selectedDateKey}
                  buttonVariant="ghost"
                  buttonSize="sm"
                  buttonText="Agendar neste dia"
                />
              </div>
            </CardHeader>

            <CardContent className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[600px] scrollbar-thin">
              {agendamentosDiaSelecionado.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4 my-auto border border-dashed rounded-xl border-muted/50 bg-muted/10 gap-3">
                  <CalendarIcon className="h-10 w-10 text-muted-foreground/30" />
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">
                      Nenhum agendamento para este dia
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5 max-w-[200px]">
                      Agende uma visita, ligação ou tarefa para este contato.
                    </p>
                  </div>
                  <NovoAgendamentoDialog
                    cadastros={cadastros}
                    defaultDateKey={selectedDateKey}
                    buttonVariant="outline"
                    buttonSize="sm"
                    buttonText="Criar Agendamento"
                  />
                </div>
              ) : (
                agendamentosDiaSelecionado.map((ev) => {
                  const Icone = iconeDoEvento(ev);
                  const cor = CORES_CATEGORIA[ev.categoria];

                  return (
                    <div
                      key={ev.id}
                      className={`p-3.5 rounded-xl border border-l-4 ${cor.border} bg-card hover:bg-muted/10 transition-all duration-150 flex flex-col gap-2 relative group shadow-2xs`}
                    >
                      {/* Top info: Contact Name and Time */}
                      <div className="flex items-start justify-between gap-2 border-b border-muted/20 pb-2">
                        <Link
                          href={
                            ev.origem === "PEDIDO"
                              ? `/pedidos/${ev.pedido.id}`
                              : `/cadastros/${ev.cadastroId}`
                          }
                          className="font-bold text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1.5 group-hover:underline"
                        >
                          <User className="h-4 w-4 text-primary shrink-0" />
                          <span>{ev.titulo}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>

                        {ev.horaStr ? (
                          <Badge variant="outline" className="text-[10px] font-mono font-bold bg-muted/50">
                            <Clock className="h-3 w-3 mr-1 text-primary" />
                            {ev.horaStr}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-medium bg-muted/30">
                            Dia inteiro
                          </Badge>
                        )}
                      </div>

                      {/* Situação + detalhes */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold flex items-center gap-1 px-2 py-0.5 ${cor.bg} ${cor.text} ${cor.border}`}
                        >
                          <Icone className="h-3 w-3" />
                          <span>{ROTULOS_CATEGORIA[ev.categoria]}</span>
                        </Badge>

                        {ev.origem === "INTERACAO" && (
                          <>
                            <Badge variant="secondary" className="text-[10px] font-semibold">
                              {ROTULOS_TIPO_INTERACAO[ev.interacao.tipo]}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold border-primary/20 bg-primary/5 text-primary"
                            >
                              {ROTULOS_ETAPA_ATENDIMENTO[ev.interacao.etapa]}
                            </Badge>
                          </>
                        )}

                        {ev.origem === "PEDIDO" && (
                          <Badge variant="secondary" className="text-[10px] font-bold">
                            R$ {ev.pedido.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </Badge>
                        )}
                      </div>

                      {/* Description preview */}
                      <p className="text-xs text-muted-foreground/90 line-clamp-3 leading-relaxed mt-0.5">
                        {ev.origem === "INTERACAO"
                          ? ev.interacao.descricao
                          : ev.pedido.itens.map((item) => item.produtoNome).join(", ")}
                      </p>

                      {/* Reagenda / Action buttons */}
                      <div className="pt-2 border-t border-muted/20 flex items-center justify-between gap-2 mt-1">
                        {ev.origem === "INTERACAO" ? (
                          <>
                            <ReagendarInteracao
                              interacaoId={ev.interacao.id}
                              cadastroId={ev.cadastroId}
                              dataReagendamento={ev.interacao.dataReagendamento ?? ""}
                            />

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px] font-semibold px-2 hover:bg-primary/10 hover:text-primary"
                              onClick={() => onSelectAtendimento(ev.atendimento.atendimentoId)}
                            >
                              Ver Histórico
                            </Button>
                          </>
                        ) : (
                          <>
                            <Link
                              href={`/cadastros/${ev.cadastroId}`}
                              className="text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors"
                            >
                              Ver cliente
                            </Link>

                            <Link
                              href={`/pedidos/${ev.pedido.id}`}
                              className="text-[11px] font-semibold text-primary hover:underline"
                            >
                              {ev.pedido.status === "PEDIDO" ? "Ver pedido" : "Ver orçamento"}
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
        )}
      </div>
    </div>
  );
}
