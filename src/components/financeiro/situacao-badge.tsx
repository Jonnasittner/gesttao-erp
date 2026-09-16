import { Badge } from "@/components/ui/badge";
import { estaVencido } from "@/lib/financeiro";
import type { Lancamento } from "@/lib/types";

/** Recebido/Pago, Vencido, Vence hoje ou Pendente. */
export function SituacaoBadge({ lancamento: l, hoje }: { lancamento: Lancamento; hoje: string }) {
  const aReceber = l.tipo === "RECEBER";
  if (l.status === "PAGO") return <Badge variant="secondary">{aReceber ? "Recebido" : "Pago"}</Badge>;
  if (estaVencido(l, hoje)) {
    return (
      <Badge
        variant="outline"
        className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      >
        Vencido
      </Badge>
    );
  }
  if (l.vencimento === hoje) return <Badge variant="outline">Vence hoje</Badge>;
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Pendente
    </Badge>
  );
}
