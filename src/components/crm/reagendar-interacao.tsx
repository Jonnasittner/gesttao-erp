"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AtalhosReagendamento } from "@/components/crm/atalhos-reagendamento";
import { reagendarInteracao } from "@/server/crm";
import { formatarReagendamento, temHorario } from "@/lib/datetime";

export function ReagendarInteracao({
  interacaoId,
  cadastroId,
  dataReagendamento,
}: {
  interacaoId: string;
  cadastroId: string;
  dataReagendamento: string;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [data, setData] = useState(dataReagendamento ? dataReagendamento.slice(0, 10) : "");
  const [horario, setHorario] = useState(
    dataReagendamento && temHorario(dataReagendamento) ? dataReagendamento.slice(11, 16) : ""
  );
  const [diaInteiro, setDiaInteiro] = useState(
    dataReagendamento ? !temHorario(dataReagendamento) : false
  );
  const [isPending, startTransition] = useTransition();

  function salvar() {
    const valor = !data ? "" : diaInteiro || !horario ? data : `${data}T${horario}`;

    startTransition(async () => {
      try {
        await reagendarInteracao(interacaoId, cadastroId, valor);
        toast.success(valor ? "Atendimento reagendado." : "Reagendamento removido.");
        setEditando(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao reagendar.");
      }
    });
  }

  if (editando) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1">
          <Input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="h-7 w-36 text-xs"
            autoFocus
          />
          {data && !diaInteiro && (
            <Input
              type="time"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              className="h-7 w-24 text-xs"
            />
          )}
          {data && (
            <label className="flex items-center gap-1 text-xs font-normal">
              <Checkbox checked={diaInteiro} onCheckedChange={(v) => setDiaInteiro(!!v)} />
              Dia inteiro
            </label>
          )}
          <Button type="button" size="sm" className="h-7" disabled={isPending} onClick={salvar}>
            Salvar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={() => setEditando(false)}
          >
            Cancelar
          </Button>
        </div>
        <AtalhosReagendamento
          onEscolher={(novaData) => {
            setData(novaData);
            setDiaInteiro(true);
            setHorario("");
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
    >
      <CalendarClock className="h-3 w-3" />
      {dataReagendamento
        ? `Reagendado para ${formatarReagendamento(dataReagendamento)}`
        : "Reagendar atendimento"}
    </button>
  );
}
