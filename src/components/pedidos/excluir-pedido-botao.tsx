"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { excluirPedido } from "@/server/pedidos";

export function ExcluirPedidoBotao({ id, numero }: { id: string; numero: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleExcluir() {
    if (!confirm(`Excluir o orçamento ${numero}?`)) return;
    startTransition(async () => {
      try {
        await excluirPedido(id);
        toast.success("Orçamento excluído.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao excluir orçamento.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Excluir orçamento ${numero}`}
      disabled={isPending}
      onClick={handleExcluir}
    >
      <Trash2Icon />
    </Button>
  );
}
