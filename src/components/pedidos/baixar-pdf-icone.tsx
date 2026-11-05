"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Botão só com ícone que baixa o PDF do pedido/orçamento direto para os
 * downloads. Enquanto o PDF é gerado, o ícone vira uma rodinha girando.
 */
export function BaixarPdfIcone({ pedidoId, nomeArquivo }: { pedidoId: string; nomeArquivo: string }) {
  const [baixando, setBaixando] = useState(false);

  async function baixar() {
    if (baixando) return;
    setBaixando(true);
    try {
      const resposta = await fetch(`/api/pedidos/${pedidoId}/pdf`);
      if (!resposta.ok) throw new Error("Não foi possível gerar o PDF.");
      const url = URL.createObjectURL(await resposta.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Dá tempo do navegador começar o download antes de liberar o arquivo.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao baixar o PDF.");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={baixar}
      disabled={baixando}
      title={baixando ? "Baixando PDF…" : "Baixar PDF"}
      aria-label={baixando ? "Baixando PDF" : "Baixar PDF"}
      aria-busy={baixando}
    >
      {baixando ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
    </Button>
  );
}
