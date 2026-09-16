import Link from "next/link";
import { CheckCircle2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConverterPedidoBotaoProps {
  id: string;
  numero: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon-sm";
  showText?: boolean;
}

/**
 * Leva para a tela de condição de pagamento (lançamento financeiro já
 * preenchido); a conversão em pedido acontece ao salvar lá.
 */
export function ConverterPedidoBotao({
  id,
  numero,
  variant = "outline",
  size = "sm",
  showText = true,
}: ConverterPedidoBotaoProps) {
  return (
    <Button
      variant={variant}
      size={size}
      nativeButton={false}
      aria-label={`Transformar orçamento ${numero} em pedido`}
      title="Transformar em pedido"
      className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
      render={
        <Link href={`/financeiro/novo?converterPedido=${id}`}>
          <CheckCircle2Icon className="size-4" />
          {showText && <span>Transformar em Pedido</span>}
        </Link>
      }
    />
  );
}
