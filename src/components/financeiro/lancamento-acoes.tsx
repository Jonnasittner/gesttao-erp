"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, PencilIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { alterarStatusLancamento, excluirLancamento } from "@/server/financeiro";
import { hojeISO } from "@/lib/datetime";
import type { Lancamento } from "@/lib/types";

export function LancamentoAcoes({ lancamento, documento }: { lancamento: Lancamento; documento: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const aReceber = lancamento.tipo === "RECEBER";
  const pago = lancamento.status === "PAGO";

  function executar(acao: () => Promise<void>, sucesso: string) {
    startTransition(async () => {
      try {
        await acao();
        toast.success(sucesso);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao atualizar lançamento.");
      }
    });
  }

  function marcarPago() {
    executar(
      () => alterarStatusLancamento(lancamento.id, hojeISO()),
      `Lançamento ${documento} marcado como ${aReceber ? "recebido" : "pago"} hoje.`
    );
  }

  function voltarPendente() {
    if (!confirm(`Voltar o lançamento ${documento} para pendente?`)) return;
    executar(() => alterarStatusLancamento(lancamento.id, null), `Lançamento ${documento} voltou para pendente.`);
  }

  function excluir() {
    if (!confirm(`Excluir o lançamento ${documento}? Essa ação não pode ser desfeita.`)) return;
    executar(() => excluirLancamento(lancamento.id), `Lançamento ${documento} excluído.`);
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {pago ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={isPending}
          onClick={voltarPendente}
          aria-label={`Voltar ${documento} para pendente`}
          title="Voltar para pendente"
        >
          <Undo2Icon />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={marcarPago}
          className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
        >
          <CheckIcon /> {aReceber ? "Recebido" : "Pago"}
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        nativeButton={false}
        aria-label={`Editar ${documento}`}
        render={
          <Link href={`/financeiro/${lancamento.id}`}>
            <PencilIcon />
          </Link>
        }
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        onClick={excluir}
        aria-label={`Excluir ${documento}`}
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}
