"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { AtalhosReagendamento } from "@/components/crm/atalhos-reagendamento";
import { criarInteracao } from "@/server/crm";
import { enviarAnexos } from "@/server/anexos";
import { interacaoSchema, TIPO_INTERACAO, ETAPA_ATENDIMENTO, ETAPAS_FECHADAS, type EtapaAtendimento } from "@/lib/types";
import { ROTULOS_ETAPA_ATENDIMENTO, ROTULOS_TIPO_INTERACAO } from "@/lib/rotulos";
import { agoraDatetimeLocal } from "@/lib/datetime";

export function InteracaoForm({
  cadastroId,
  etapaAtual,
  valorEstimadoAtual,
}: {
  cadastroId: string;
  /** Etapa/valor do atendimento em aberto, se houver — a interação continua de onde parou. */
  etapaAtual?: EtapaAtendimento;
  valorEstimadoAtual?: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(agoraDatetimeLocal);
  const [etapa, setEtapa] = useState<EtapaAtendimento>(etapaAtual ?? "NOVO");
  const [reagendarData, setReagendarData] = useState("");
  const [reagendarHorario, setReagendarHorario] = useState("");
  const [reagendarDiaInteiro, setReagendarDiaInteiro] = useState(false);

  function handleSubmit(formData: FormData) {
    const dataReagendamento = !reagendarData
      ? ""
      : reagendarDiaInteiro || !reagendarHorario
        ? reagendarData
        : `${reagendarData}T${reagendarHorario}`;

    const parsed = interacaoSchema.safeParse({
      cadastroId,
      tipo: formData.get("tipo") || "NOTA",
      descricao: formData.get("descricao"),
      data,
      dataReagendamento,
      valorEstimado: formData.get("valorEstimado") || 0,
      etapa,
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
        setData(agoraDatetimeLocal());
        if (ETAPAS_FECHADAS.includes(etapa)) setEtapa("NOVO");
        setReagendarData("");
        setReagendarHorario("");
        setReagendarDiaInteiro(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao registrar interação.");
      }
    });
  }

  return (
    <form id="form-interacao" action={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <Input
            id="data"
            type="datetime-local"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="reagendarData">Reagendar para</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="reagendarData"
            type="date"
            value={reagendarData}
            onChange={(e) => setReagendarData(e.target.value)}
            className="w-40"
          />
          {reagendarData && !reagendarDiaInteiro && (
            <Input
              type="time"
              value={reagendarHorario}
              onChange={(e) => setReagendarHorario(e.target.value)}
              className="w-28"
            />
          )}
          {reagendarData && (
            <label className="flex items-center gap-1.5 text-sm font-normal">
              <Checkbox
                checked={reagendarDiaInteiro}
                onCheckedChange={(v) => setReagendarDiaInteiro(!!v)}
              />
              Dia inteiro
            </label>
          )}
        </div>
        <AtalhosReagendamento
          onEscolher={(data) => {
            setReagendarData(data);
            setReagendarDiaInteiro(true);
            setReagendarHorario("");
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="valorEstimado">Valor estimado (R$)</Label>
          <Input
            id="valorEstimado"
            name="valorEstimado"
            type="number"
            min="0"
            step="0.01"
            defaultValue={valorEstimadoAtual || undefined}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="etapa">Etapa</Label>
          <Select
            items={ROTULOS_ETAPA_ATENDIMENTO}
            value={etapa}
            onValueChange={(v) => setEtapa(v as EtapaAtendimento)}
          >
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
