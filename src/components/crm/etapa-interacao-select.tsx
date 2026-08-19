"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { atualizarEtapaInteracao } from "@/server/crm";
import { ROTULOS_ETAPA_ATENDIMENTO } from "@/lib/rotulos";
import { ETAPA_ATENDIMENTO, type EtapaAtendimento } from "@/lib/types";

export function EtapaInteracaoSelect({ id, etapa }: { id: string; etapa: EtapaAtendimento }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(novaEtapa: string | null) {
    if (!novaEtapa) return;
    startTransition(async () => {
      try {
        await atualizarEtapaInteracao(id, novaEtapa as EtapaAtendimento);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao mover atendimento.");
      }
    });
  }

  return (
    <Select
      value={etapa}
      items={ROTULOS_ETAPA_ATENDIMENTO}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger className="h-8 w-full text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ETAPA_ATENDIMENTO.map((opcao) => (
          <SelectItem key={opcao} value={opcao}>
            {ROTULOS_ETAPA_ATENDIMENTO[opcao]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
