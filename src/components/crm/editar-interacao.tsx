"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { atualizarInteracao } from "@/server/crm";
import { interacaoSchema, TIPO_INTERACAO, ETAPA_ATENDIMENTO, type Interacao } from "@/lib/types";
import { ROTULOS_ETAPA_ATENDIMENTO, ROTULOS_TIPO_INTERACAO } from "@/lib/rotulos";

export function EditarInteracao({
  interacao,
  cadastroId,
}: {
  interacao: Interacao;
  cadastroId: string;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const parsed = interacaoSchema.safeParse({
      cadastroId,
      tipo: formData.get("tipo"),
      descricao: formData.get("descricao"),
      data: formData.get("data"),
      dataReagendamento: interacao.dataReagendamento,
      valorEstimado: formData.get("valorEstimado") || 0,
      etapa: formData.get("etapa"),
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    startTransition(async () => {
      try {
        await atualizarInteracao(interacao.id, parsed.data);
        toast.success("Interação atualizada.");
        setEditando(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao atualizar interação.");
      }
    });
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        <Pencil className="h-3 w-3" />
        Editar
      </button>
    );
  }

  return (
    <form action={handleSubmit} className="flex w-full flex-col gap-3 rounded-md border p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`tipo-${interacao.id}`}>Tipo</Label>
          <Select name="tipo" items={ROTULOS_TIPO_INTERACAO} defaultValue={interacao.tipo}>
            <SelectTrigger id={`tipo-${interacao.id}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPO_INTERACAO.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {ROTULOS_TIPO_INTERACAO[tipo]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`data-${interacao.id}`}>Data</Label>
          <Input
            id={`data-${interacao.id}`}
            name="data"
            type="date"
            defaultValue={interacao.data.slice(0, 10)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`valor-${interacao.id}`}>Valor estimado (R$)</Label>
          <Input
            id={`valor-${interacao.id}`}
            name="valorEstimado"
            type="number"
            min="0"
            step="0.01"
            defaultValue={interacao.valorEstimado || ""}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:w-1/3">
        <Label htmlFor={`etapa-${interacao.id}`}>Etapa</Label>
        <Select name="etapa" items={ROTULOS_ETAPA_ATENDIMENTO} defaultValue={interacao.etapa}>
          <SelectTrigger id={`etapa-${interacao.id}`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ETAPA_ATENDIMENTO.map((etapa) => (
              <SelectItem key={etapa} value={etapa}>
                {ROTULOS_ETAPA_ATENDIMENTO[etapa]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`descricao-${interacao.id}`}>Descrição</Label>
        <Textarea
          id={`descricao-${interacao.id}`}
          name="descricao"
          rows={3}
          className="uppercase"
          defaultValue={interacao.descricao}
          required
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setEditando(false)}
          disabled={isPending}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
