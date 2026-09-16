"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";

/**
 * Desenha as páginas de um PDF em <canvas> com o PDF.js. Usado no lugar de
 * <iframe> porque navegadores de celular (Chrome no Android, Safari no iPhone)
 * não exibem PDF dentro da página — assim a prévia funciona igual no PC e no
 * celular. O build "legacy" do PDF.js suporta navegadores mais antigos.
 */
export function PaginasPdf({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelado = false;
    let tarefa: PDFDocumentLoadingTask | null = null;
    container.replaceChildren();
    setEstado("carregando");

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        tarefa = pdfjs.getDocument({ url });
        const documento = await tarefa.promise;
        // A janela abre com animação: espera o layout antes de medir a largura.
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const largura = container.clientWidth || 800;
        // Densidade de pixels limitada a 2 para não pesar em celulares.
        const densidade = Math.min(window.devicePixelRatio || 1, 2);

        for (let numero = 1; numero <= documento.numPages; numero++) {
          if (cancelado) return;
          const pagina = await documento.getPage(numero);
          const escala = largura / pagina.getViewport({ scale: 1 }).width;
          const viewport = pagina.getViewport({ scale: escala * densidade });

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "block h-auto w-full rounded-sm bg-white shadow-sm";
          canvas.setAttribute("aria-label", `Página ${numero} de ${documento.numPages}`);
          container.appendChild(canvas);

          await pagina.render({ canvas, viewport }).promise;
          // Mostra a primeira página assim que ela fica pronta.
          if (numero === 1 && !cancelado) setEstado("pronto");
        }
      } catch (erro) {
        if (!cancelado) {
          console.error("Falha ao exibir PDF", erro);
          setEstado("erro");
        }
      }
    })();

    return () => {
      cancelado = true;
      // Cancela o carregamento e libera memória (worker, páginas).
      void tarefa?.destroy();
    };
  }, [url]);

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted p-2 sm:p-4">
      <div ref={containerRef} className="mx-auto flex max-w-3xl flex-col gap-3" />

      {estado === "carregando" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
          Gerando PDF...
        </div>
      )}

      {estado === "erro" && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Não foi possível mostrar a prévia. Use &quot;Abrir em nova aba&quot; ou baixe o PDF.
        </div>
      )}
    </div>
  );
}
