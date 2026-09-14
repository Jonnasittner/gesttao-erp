"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { converterEmPedido } from "@/server/pedidos";

interface ConverterPedidoBotaoProps {
  id: string;
  numero: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon-sm";
  showText?: boolean;
}

export function ConverterPedidoBotao({
  id,
  numero,
  variant = "outline",
  size = "sm",
  showText = true,
}: ConverterPedidoBotaoProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleConverter() {
    if (!confirm(`Transformar o orçamento ${numero} em pedido?`)) return;
    startTransition(async () => {
      try {
        await converterEmPedido(id);
        toast.success(`Orçamento ${numero} transformado em pedido e enviado ao CRM!`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao converter orçamento em pedido.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      aria-label={`Transformar orçamento ${numero} em pedido`}
      disabled={isPending}
      onClick={handleConverter}
      className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
    >
      <CheckCircle2Icon className="size-4" />
      {showText && <span>{isPending ? "Convertendo..." : "Transformar em Pedido"}</span>}
    </Button>
  );
}
