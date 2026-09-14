"use client";

import { useState } from "react";
import { toast } from "sonner";
import { EyeIcon, ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

      <Dialog open={url !== null} onOpenChange={(aberto) => !aberto && fechar()}>
        <DialogContent className="flex h-[92vh] flex-col gap-3 sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Prévia do PDF</DialogTitle>
            <DialogDescription>
              Nada foi salvo ainda. Confira e salve, ou volte para ajustar.
            </DialogDescription>
          </DialogHeader>

          {url && (
            <iframe
              src={url}
              title="Prévia do PDF do orçamento"
              className="min-h-0 w-full flex-1 rounded-md border bg-muted"
            />
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {url && (
              <Button
                variant="ghost"
                nativeButton={false}
                render={
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon /> Abrir em nova aba
                  </a>
                }
              />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
