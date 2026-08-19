"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { criarInteracao } from "@/server/crm";
import { enviarAnexos } from "@/server/anexos";
import { interacaoSchema, TIPO_INTERACAO, ETAPA_ATENDIMENTO } from "@/lib/types";
import { ROTULOS_ETAPA_ATENDIMENTO, ROTULOS_TIPO_INTERACAO } from "@/lib/rotulos";

export function InteracaoForm({ cadastroId }: { cadastroId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const parsed = interacaoSchema.safeParse({
      cadastroId,
      tipo: formData.get("tipo") || "NOTA",
      descricao: formData.get("descricao"),
      data: formData.get("data"),
      dataReagendamento: formData.get("dataReagendamento"),
      valorEstimado: formData.get("valorEstimado") || 0,
      etapa: formData.get("etapa") || "NOVO",
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    startTransition(async () => {
      try {
        const { id } = await criarInteracao(parsed.data);
        if (formData.getAll("arquivos").some((a) => a instanceof File && a.size > 0)) {
          await enviarAnexos(cadastroId, id, formData);
        }
        toast.success("Interação registrada.");
        router.refresh();
        (document.getElementById("form-interacao") as HTMLFormElement | null)?.reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao registrar interação.");
      }
    });
  }

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <form id="form-interacao" action={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tipo">Tipo</Label>
          <Select name="tipo" items={ROTULOS_TIPO_INTERACAO} defaultValue="NOTA">
            <SelectTrigger id="tipo" className="w-full">
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
          <Label htmlFor="data">Data</Label>
          <Input id="data" name="data" type="date" defaultValue={hoje} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="dataReagendamento">Reagendar para</Label>
          <Input id="dataReagendamento" name="dataReagendamento" type="date" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="valorEstimado">Valor estimado (R$)</Label>
          <Input id="valorEstimado" name="valorEstimado" type="number" min="0" step="0.01" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="etapa">Etapa</Label>
          <Select name="etapa" items={ROTULOS_ETAPA_ATENDIMENTO} defaultValue="NOVO">
            <SelectTrigger id="etapa" className="w-full">
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
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea id="descricao" name="descricao" rows={3} className="uppercase" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="arquivos">Anexos</Label>
        <Input id="arquivos" name="arquivos" type="file" multiple />
      </div>

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Salvando..." : "Registrar interação"}
      </Button>
    </form>
  );
}
