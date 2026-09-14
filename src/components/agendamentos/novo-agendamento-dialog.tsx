"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Calendar, Clock, User, FileText, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { criarInteracao } from "@/server/crm";
import {
  interacaoSchema,
  TIPO_INTERACAO,
  ETAPA_ATENDIMENTO,
  type EtapaAtendimento,
  type TipoInteracao,
  type Cadastro,
} from "@/lib/types";
import { ROTULOS_ETAPA_ATENDIMENTO, ROTULOS_TIPO_INTERACAO } from "@/lib/rotulos";
import { agoraDatetimeLocal } from "@/lib/datetime";

interface NovoAgendamentoDialogProps {
  cadastros: Cadastro[];
  defaultDateKey?: string; // YYYY-MM-DD
  buttonVariant?: "default" | "outline" | "secondary" | "ghost";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  buttonText?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function NovoAgendamentoDialog({
  cadastros,
  defaultDateKey,
  buttonVariant = "default",
  buttonSize = "sm",
  buttonText = "Novo Agendamento",
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: NovoAgendamentoDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  // Estado do campo cliente (combobox de busca)
  const [cadastroId, setCadastroId] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [listaClienteAberta, setListaClienteAberta] = useState(false);
  const containerClienteRef = useRef<HTMLDivElement>(null);

  // Demais campos
  const [tipo, setTipo] = useState<TipoInteracao>("VISITA");
  const [etapa, setEtapa] = useState<EtapaAtendimento>("QUALIFICADO");
  const [dataAgendamento, setDataAgendamento] = useState(() => defaultDateKey || "");
  const [horario, setHorario] = useState("");
  const [diaInteiro, setDiaInteiro] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [valorEstimado, setValorEstimado] = useState("");

  // Fecha lista de clientes ao clicar fora
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerClienteRef.current && !containerClienteRef.current.contains(e.target as Node)) {
        setListaClienteAberta(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const clienteSelecionado = cadastros.find((c) => c.id === cadastroId) ?? null;

  const cadastrosFiltrados = buscaCliente.trim()
    ? cadastros.filter((c) => c.nome.toLowerCase().includes(buscaCliente.toLowerCase())).slice(0, 8)
    : cadastros.slice(0, 8);

  function selecionarCliente(c: Cadastro) {
    setCadastroId(c.id);
    setBuscaCliente(c.nome);
    setListaClienteAberta(false);
  }

  // Sync date if defaultDateKey changes when dialog opens
  function handleOpenChange(newOpen: boolean) {
    if (controlledOnOpenChange) {
      controlledOnOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
    if (newOpen && defaultDateKey) {
      setDataAgendamento(defaultDateKey);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!cadastroId) {
      toast.error("Selecione um cliente/cadastro.");
      return;
    }

    if (!dataAgendamento) {
      toast.error("Informe a data do agendamento.");
      return;
    }

    const dataReagendamento = diaInteiro || !horario
      ? dataAgendamento
      : `${dataAgendamento}T${horario}`;

    const parsed = interacaoSchema.safeParse({
      cadastroId,
      tipo,
      descricao,
      data: agoraDatetimeLocal(),
      dataReagendamento,
      valorEstimado: valorEstimado ? Number(valorEstimado) : 0,
      etapa,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Preencha todos os campos obrigatórios.");
      return;
    }

    startTransition(async () => {
      try {
        await criarInteracao(parsed.data);
        toast.success("Agendamento criado com sucesso!");
        handleOpenChange(false);
        setCadastroId("");
        setBuscaCliente("");
        setDescricao("");
        setValorEstimado("");
        setHorario("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao criar agendamento.");
      }
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger
          render={
            <Button variant={buttonVariant} size={buttonSize} className="gap-1.5 font-bold shadow-sm">
              <Plus className="h-4 w-4" />
              <span>{buttonText}</span>
            </Button>
          }
        />
      )}

      <DialogContent className="sm:max-w-lg rounded-2xl p-6 glass-card border border-white/20 dark:border-white/10 shadow-2xl">
        <DialogHeader className="border-b pb-3 border-muted/30">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
            <Calendar className="h-5 w-5 text-primary" />
            <span>Novo Agendamento de Contato</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Agende uma visita, ligação ou retorno comercial diretamente na agenda.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {/* Campo de busca de cliente */}
          <div className="flex flex-col gap-1.5" ref={containerClienteRef}>
            <Label htmlFor="buscaCliente" className="text-xs font-semibold flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Cliente / Contato</span>
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="buscaCliente"
                value={clienteSelecionado ? clienteSelecionado.nome : buscaCliente}
                placeholder="Buscar cliente pelo nome..."
                className="pl-8 text-xs uppercase"
                autoComplete="off"
                onChange={(e) => {
                  setBuscaCliente(e.target.value);
                  setCadastroId(""); // limpa seleção ao editar
                  setListaClienteAberta(true);
                }}
                onFocus={() => setListaClienteAberta(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setListaClienteAberta(false);
                }}
              />
              {listaClienteAberta && cadastrosFiltrados.length > 0 && (
                <div className="absolute top-full z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-lg bg-popover py-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
                  {cadastrosFiltrados.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full flex-col px-3 py-2 text-left text-xs hover:bg-accent"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selecionarCliente(c);
                      }}
                    >
                      <span className="font-medium uppercase">{c.nome}</span>
                      {c.documento && (
                        <span className="text-muted-foreground">{c.documento}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tipo e Etapa */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tipo" className="text-xs font-semibold">Tipo</Label>
              <Select value={tipo} items={ROTULOS_TIPO_INTERACAO} onValueChange={(v) => setTipo((v as TipoInteracao) ?? "VISITA")}>
                <SelectTrigger id="tipo" className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_INTERACAO.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {ROTULOS_TIPO_INTERACAO[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="etapa" className="text-xs font-semibold">Etapa Atendimento</Label>
              <Select value={etapa} items={ROTULOS_ETAPA_ATENDIMENTO} onValueChange={(v) => setEtapa((v as EtapaAtendimento) ?? "QUALIFICADO")}>
                <SelectTrigger id="etapa" className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ETAPA_ATENDIMENTO.map((e) => (
                    <SelectItem key={e} value={e} className="text-xs">
                      {ROTULOS_ETAPA_ATENDIMENTO[e]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Data e Horário */}
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-muted/20 border border-muted/30">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>Data e Horário do Agendamento</span>
            </Label>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={dataAgendamento}
                onChange={(e) => setDataAgendamento(e.target.value)}
                className="w-38 text-xs bg-background"
                required
              />

              {!diaInteiro && (
                <Input
                  type="time"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  className="w-28 text-xs bg-background"
                />
              )}

              <label className="flex items-center gap-1.5 text-xs text-muted-foreground select-none cursor-pointer">
                <Checkbox
                  checked={diaInteiro}
                  onCheckedChange={(v) => setDiaInteiro(!!v)}
                />
                <span>Dia inteiro</span>
              </label>
            </div>
          </div>

          {/* Descrição */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="descricao" className="text-xs font-semibold flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Descrição / Objetivo</span>
            </Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: REUNIÃO DE APRESENTAÇÃO DE PROPOSTA COM O CLIENTE..."
              rows={3}
              className="uppercase text-xs"
              required
            />
          </div>

          {/* Valor Estimado */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="valorEstimado" className="text-xs font-semibold">Valor Estimado (R$ opcional)</Label>
            <Input
              id="valorEstimado"
              type="number"
              min="0"
              step="0.01"
              value={valorEstimado}
              onChange={(e) => setValorEstimado(e.target.value)}
              placeholder="0,00"
              className="text-xs"
            />
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-muted/30">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isPending} className="font-bold">
              {isPending ? "Agendando..." : "Confirmar Agendamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
