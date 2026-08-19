"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reagendarInteracao } from "@/server/crm";

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
  const [valor, setValor] = useState(dataReagendamento ? dataReagendamento.slice(0, 10) : "");
  const [isPending, startTransition] = useTransition();

  function salvar() {
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
      <div className="flex flex-wrap items-center gap-1">
        <Input
          type="date"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="h-7 w-36 text-xs"
          autoFocus
        />
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
        ? `Reagendado para ${new Date(dataReagendamento).toLocaleDateString("pt-BR")}`
        : "Reagendar atendimento"}
    </button>
  );
}
