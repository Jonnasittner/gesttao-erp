"use client";

import { useState } from "react";
import { toast } from "sonner";
import { EyeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VisualizadorPdf } from "@/components/pedidos/visualizador-pdf";
import type { PedidoInput } from "@/lib/types";

interface PreviaPdfBotaoProps {
  /** Valida o formulário e devolve os dados (ou null, já tendo avisado o erro). */
  montarDados: () => PedidoInput | null;
  /** Só na edição: número e data do orçamento já salvo, para a prévia sair igual. */
  numero?: number;
  createdAt?: string;
  onSalvar: () => void;
  salvando: boolean;
  textoSalvar: string;
}

export function PreviaPdfBotao({
  montarDados,
  numero,
  createdAt,
  onSalvar,
  salvando,
  textoSalvar,
}: PreviaPdfBotaoProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  function fechar() {
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
  }

  async function gerarPrevia() {
    const dados = montarDados();
    if (!dados) return;

    setGerando(true);
    try {
      const resposta = await fetch("/api/pedidos/previa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dados, numero, createdAt }),
      });
      if (!resposta.ok) {
        throw new Error((await resposta.text()) || "Não foi possível gerar a prévia.");
      }
      setUrl(URL.createObjectURL(await resposta.blob()));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar a prévia.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" disabled={gerando || salvando} onClick={gerarPrevia}>
        <EyeIcon /> {gerando ? "Gerando prévia..." : "Pré-visualizar PDF"}
      </Button>

      <VisualizadorPdf
        url={url}
        titulo="Prévia do PDF"
        descricao="Nada foi salvo ainda. Confira e salve, ou volte para ajustar."
        onFechar={fechar}
        acoes={
          <>
            <Button type="button" variant="outline" onClick={fechar}>
              Voltar e editar
            </Button>
            <Button
              type="button"
              disabled={salvando}
              onClick={() => {
                fechar();
                onSalvar();
              }}
            >
              {textoSalvar}
            </Button>
          </>
        }
      />
    </>
  );
}
