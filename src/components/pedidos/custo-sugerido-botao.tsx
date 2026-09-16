"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalculatorIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { definirCustoSugerido } from "@/server/pedidos";
import { formatarMoeda } from "@/lib/moeda";

interface CustoSugeridoBotaoProps {
  pedidoId: string;
  custoSugerido: number | null;
  /** Custo calculado pela tabela dos produtos (custo por m²); 0 se não dá para calcular. */
  custoCalculado: number;
}

export function CustoSugeridoBotao({ pedidoId, custoSugerido, custoCalculado }: CustoSugeridoBotaoProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");
  const [isPending, startTransition] = useTransition();
  const temValor = custoSugerido !== null;

  function abrir() {
    // Sem valor salvo, já começa com o cálculo pelos produtos (se houver).
    setValor(temValor ? String(custoSugerido) : custoCalculado > 0 ? String(custoCalculado) : "");
    setAberto(true);
  }

  function salvar(novo: number | null, mensagem: string) {
    startTransition(async () => {
      try {
        await definirCustoSugerido(pedidoId, novo);
        toast.success(mensagem);
        setAberto(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar custo sugerido.");
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numero = Number(valor);
    if (valor.trim() === "" || !Number.isFinite(numero) || numero < 0) {
      toast.error("Informe um custo sugerido válido.");
      return;
    }
    salvar(numero, `Custo sugerido de ${formatarMoeda(numero)} salvo.`);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={abrir}>
        <CalculatorIcon /> {temValor ? "Alterar custo sugerido" : "Custo sugerido"}
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Custo sugerido</DialogTitle>
              <DialogDescription>
                Quanto você espera pagar pela mercadoria antes da fábrica confirmar. Serve de base para conferir
                se o valor passado pela fábrica está certo.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="custoSugerido">Custo sugerido (R$)</Label>
              <Input
                id="custoSugerido"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                autoFocus
              />
              {custoCalculado > 0 && (
                <p className="text-xs text-muted-foreground">
                  Pela tabela dos produtos (custo por m²): {formatarMoeda(custoCalculado)}.{" "}
                  {Number(valor) !== custoCalculado && (
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => setValor(String(custoCalculado))}
                    >
                      Usar este valor
                    </button>
                  )}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              {temValor ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => salvar(null, "Custo sugerido removido.")}
                  className="text-muted-foreground"
                >
                  Remover
                </Button>
              ) : (
                <span />
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => setAberto(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
