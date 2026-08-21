"use client";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

export function ImagemProduto({ url, alt }: { url: string; alt: string }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button type="button" className="block cursor-zoom-in" aria-label={`Ampliar imagem de ${alt}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={alt} className="h-16 w-28 rounded-md border object-cover" />
          </button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} className="w-full rounded-lg object-contain" />
      </DialogContent>
    </Dialog>
  );
}
