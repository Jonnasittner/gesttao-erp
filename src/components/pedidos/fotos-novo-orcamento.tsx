"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { comprimirImagem } from "@/lib/comprimir-imagem";
import { MAX_FOTOS_PEDIDO } from "@/lib/types";

/** Foto escolhida na janela de novo orçamento, ainda não enviada. */
export interface FotoNova {
  chave: string;
  /** Já reduzida (máx. 1600px, JPEG), pronta para enviar ao salvar. */
  arquivo: File;
  /** URL local só para a miniatura. */
  preview: string;
}

export function liberarPreviews(fotos: FotoNova[]) {
  fotos.forEach((f) => URL.revokeObjectURL(f.preview));
}

/**
 * Escolha de fotos antes de o orçamento existir: ficam na memória da janela e
 * são enviadas depois de salvar (ver NovoPedidoDialog).
 */
export function FotosNovoOrcamento({
  fotos,
  onChange,
  desabilitado,
}: {
  fotos: FotoNova[];
  onChange: (fotos: FotoNova[]) => void;
  desabilitado?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparando, setPreparando] = useState(false);
  const restantes = MAX_FOTOS_PEDIDO - fotos.length;

  async function adicionar(lista: FileList | null) {
    const arquivos = [...(lista ?? [])].filter((a) => a.type.startsWith("image/"));
    if (inputRef.current) inputRef.current.value = "";
    if (arquivos.length === 0) return;
    if (arquivos.length > restantes) {
      toast.error(`Dá para adicionar mais ${restantes} foto${restantes === 1 ? "" : "s"} (limite de ${MAX_FOTOS_PEDIDO}).`);
      return;
    }

    setPreparando(true);
    try {
      const novas: FotoNova[] = [];
      for (const arquivo of arquivos) {
        const reduzida = await comprimirImagem(arquivo);
        novas.push({ chave: crypto.randomUUID(), arquivo: reduzida, preview: URL.createObjectURL(reduzida) });
      }
      onChange([...fotos, ...novas]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível preparar a foto.");
    } finally {
      setPreparando(false);
    }
  }

  function remover(chave: string) {
    const foto = fotos.find((f) => f.chave === chave);
    if (foto) URL.revokeObjectURL(foto.preview);
    onChange(fotos.filter((f) => f.chave !== chave));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>
          Fotos {fotos.length > 0 && <span className="font-normal text-muted-foreground">({fotos.length}/{MAX_FOTOS_PEDIDO})</span>}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={desabilitado || preparando || restantes <= 0}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlusIcon /> {preparando ? "Preparando..." : "Adicionar fotos"}
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

      {fotos.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {fotos.map((foto, i) => (
            <div key={foto.chave} className="relative aspect-[4/3] overflow-hidden rounded-md border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto.preview} alt={`Foto ${i + 1}`} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => remover(foto.chave)}
                disabled={desabilitado}
                aria-label={`Tirar foto ${i + 1}`}
                className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <XIcon className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Opcional. Aparecem no PDF, acima das observações.</p>
      )}
    </div>
  );
}
