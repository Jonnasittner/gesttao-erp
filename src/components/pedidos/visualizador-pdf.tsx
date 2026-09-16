"use client";

import { ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaginasPdf } from "@/components/pedidos/paginas-pdf";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VisualizadorPdfProps {
  /** URL do PDF (blob: ou rota da API). null = janela fechada. */
  url: string | null;
  titulo: string;
  descricao: string;
  onFechar: () => void;
  /** Botões da direita do rodapé (ex.: Voltar/Salvar, Fechar/Baixar). */
  acoes: React.ReactNode;
}

/** Janela grande que mostra um PDF antes de salvar ou baixar. */
export function VisualizadorPdf({ url, titulo, descricao, onFechar, acoes }: VisualizadorPdfProps) {
  return (
    <Dialog open={url !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="flex h-[92vh] flex-col gap-3 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        {url && <PaginasPdf url={url} />}

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
          <div className="flex flex-col-reverse gap-2 sm:flex-row">{acoes}</div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
