"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { enviarFotoPedido, excluirFotoPedido } from "@/server/pedidos";
import { comprimirImagem } from "@/lib/comprimir-imagem";
import { MAX_FOTOS_PEDIDO, type FotoPedido } from "@/lib/types";

/** Fotos do orçamento (aparecem no PDF acima das observações). */
export function FotosPedido({ pedidoId, fotos }: { pedidoId: string; fotos: FotoPedido[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState<FotoPedido | null>(null);
  const [isPending, startTransition] = useTransition();
  const restantes = MAX_FOTOS_PEDIDO - fotos.length;

  async function adicionar(lista: FileList | null) {
    if (!lista?.length) return;
    const arquivos = [...lista].filter((a) => a.type.startsWith("image/"));
    if (inputRef.current) inputRef.current.value = "";

    if (arquivos.length === 0) {
      toast.error("Escolha arquivos de imagem.");
      return;
    }
    if (arquivos.length > restantes) {
      toast.error(`Dá para adicionar mais ${restantes} foto${restantes === 1 ? "" : "s"} (limite de ${MAX_FOTOS_PEDIDO}).`);
      return;
    }

    let enviadas = 0;
    try {
      for (const [i, arquivo] of arquivos.entries()) {
        setEnviando(`Enviando ${i + 1} de ${arquivos.length}...`);
        const formData = new FormData();
        formData.set("foto", await comprimirImagem(arquivo));
        await enviarFotoPedido(pedidoId, formData);
        enviadas++;
      }
      toast.success(enviadas === 1 ? "Foto adicionada." : `${enviadas} fotos adicionadas.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar foto.");
    } finally {
      setEnviando(null);
      if (enviadas > 0) router.refresh();
    }
  }

  function excluir(foto: FotoPedido) {
    if (!confirm("Remover esta foto do orçamento?")) return;
    startTransition(async () => {
      try {
        await excluirFotoPedido(pedidoId, foto.id);
        setAmpliada(null);
        toast.success("Foto removida.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao remover foto.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">
            Fotos {fotos.length > 0 && `(${fotos.length}/${MAX_FOTOS_PEDIDO})`}
          </h2>
          <p className="text-xs text-muted-foreground">Aparecem no PDF, acima das observações.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!!enviando || restantes <= 0}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlusIcon /> {enviando ?? "Adicionar fotos"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => adicionar(e.target.files)}
        />
      </div>

      {fotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {fotos.map((foto, i) => (
            <div key={foto.id} className="group relative aspect-[4/3] overflow-hidden rounded-md border bg-muted">
              <button
                type="button"
                className="block size-full cursor-zoom-in"
                onClick={() => setAmpliada(foto)}
                aria-label={`Ampliar foto ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={foto.url} alt={`Foto ${i + 1}`} className="size-full object-cover" loading="lazy" />
              </button>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                disabled={isPending}
                onClick={() => excluir(foto)}
                aria-label={`Remover foto ${i + 1}`}
                className="absolute right-1 top-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={ampliada !== null} onOpenChange={(aberto) => !aberto && setAmpliada(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogTitle className="sr-only">Foto do orçamento</DialogTitle>
          {ampliada && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ampliada.url} alt="Foto do orçamento" className="max-h-[75vh] w-full rounded-md object-contain" />
              <div className="flex justify-end">
                <Button type="button" variant="ghost" disabled={isPending} onClick={() => excluir(ampliada)}>
                  <Trash2Icon /> Remover foto
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
