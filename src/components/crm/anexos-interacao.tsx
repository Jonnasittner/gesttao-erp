"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { File as FileIcon, Paperclip, Trash2 } from "lucide-react";
import { enviarAnexos, excluirAnexo } from "@/server/anexos";
import type { Anexo } from "@/lib/types";

function formatarTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AnexosInteracao({
  interacaoId,
  cadastroId,
  anexos,
}: {
  interacaoId: string;
  cadastroId: string;
  anexos: Anexo[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (const file of files) formData.append("arquivos", file);

    startTransition(async () => {
      try {
        await enviarAnexos(cadastroId, interacaoId, formData);
        toast.success("Anexo(s) enviado(s).");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao enviar anexo.");
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function handleExcluir(id: string, nome: string) {
    if (!confirm(`Excluir o anexo "${nome}"?`)) return;
    startTransition(async () => {
      try {
        await excluirAnexo(id, cadastroId);
        toast.success("Anexo removido.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao excluir anexo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {anexos.map((anexo) => (
        <div key={anexo.id} className="flex items-center gap-2 text-xs">
          <a
            href={anexo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-foreground hover:underline"
          >
            <FileIcon className="h-3.5 w-3.5" />
            {anexo.nomeArquivo}
          </a>
          <span className="text-muted-foreground">({formatarTamanho(anexo.tamanho)})</span>
          <button
            type="button"
            onClick={() => handleExcluir(anexo.id, anexo.nomeArquivo)}
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Excluir ${anexo.nomeArquivo}`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}

      <label className="flex w-fit cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline">
        <Paperclip className="h-3 w-3" />
        {isPending ? "Enviando..." : "Anexar arquivo"}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
          disabled={isPending}
        />
      </label>
    </div>
  );
}
