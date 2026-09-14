"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VisualizadorPdf } from "@/components/pedidos/visualizador-pdf";

interface BaixarPdfBotaoProps {
  pedidoId: string;
  /** Ex.: "orcamento-0012.pdf" */
  nomeArquivo: string;
  titulo: string;
}

/** "Baixar PDF" abre primeiro a visualização; o download sai de dentro dela. */
export function BaixarPdfBotao({ pedidoId, nomeArquivo, titulo }: BaixarPdfBotaoProps) {
  const [aberto, setAberto] = useState(false);
  const urlPdf = `/api/pedidos/${pedidoId}/pdf`;

  return (
    <>
      <Button type="button" onClick={() => setAberto(true)}>
        <DownloadIcon /> Baixar PDF
      </Button>

      <VisualizadorPdf
        url={aberto ? `${urlPdf}?visualizar=1` : null}
        titulo={titulo}
        descricao="Confira o PDF antes de baixar."
        onFechar={() => setAberto(false)}
        acoes={
          <>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Fechar
            </Button>
            <Button
              nativeButton={false}
              render={
                <a href={urlPdf} download={nomeArquivo}>
                  <DownloadIcon /> Baixar PDF
                </a>
              }
            />
          </>
        }
      />
    </>
  );
}
