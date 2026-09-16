"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, PencilIcon, Trash2Icon, Undo2Icon } from "lucide-react";
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
import { alterarStatusLancamento, excluirLancamento } from "@/server/financeiro";
import { hojeISO } from "@/lib/datetime";
import { formatarMoeda } from "@/lib/moeda";
import { ID_LISTA_BANCOS } from "@/lib/financeiro";
import type { Lancamento } from "@/lib/types";

export function LancamentoAcoes({ lancamento, documento }: { lancamento: Lancamento; documento: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [dataPagamento, setDataPagamento] = useState(hojeISO());
  const [banco, setBanco] = useState("");

  const aReceber = lancamento.tipo === "RECEBER";
  const pago = lancamento.status === "PAGO";
  const verbo = aReceber ? "recebido" : "pago";

  function executar(acao: () => Promise<void>, sucesso: string, depois?: () => void) {
    startTransition(async () => {
      try {
        await acao();
        toast.success(sucesso);
        depois?.();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao atualizar lançamento.");
      }
    });
  }

  function abrirConfirmacao() {
    setDataPagamento(hojeISO());
    setBanco("");
    setConfirmando(true);
  }

  function confirmarPagamento(e: React.FormEvent) {
    e.preventDefault();
    if (!dataPagamento) {
      toast.error(`Informe a data em que foi ${verbo}.`);
      return;
    }
    executar(
      () => alterarStatusLancamento(lancamento.id, dataPagamento, banco),
      `${documento} marcado como ${verbo}.`,
      () => setConfirmando(false)
    );
  }

  function voltarPendente() {
    if (!confirm(`Voltar ${documento} para pendente?`)) return;
    executar(() => alterarStatusLancamento(lancamento.id, null), `${documento} voltou para pendente.`);
  }

  function excluir() {
    const aviso =
      lancamento.totalParcelas > 1
        ? `Excluir o lançamento inteiro, com as ${lancamento.totalParcelas} parcelas? Essa ação não pode ser desfeita.`
        : `Excluir o lançamento ${documento}? Essa ação não pode ser desfeita.`;
    if (!confirm(aviso)) return;
    executar(() => excluirLancamento(lancamento.id), "Lançamento excluído.");
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
          onClick={abrirConfirmacao}
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

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={confirmarPagamento} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Marcar como {verbo}</DialogTitle>
              <DialogDescription>
                {documento} · {aReceber ? lancamento.clienteNome : lancamento.fornecedorNome} ·{" "}
                {formatarMoeda(lancamento.valor)}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`data-${lancamento.id}`}>{aReceber ? "Recebido em" : "Pago em"}</Label>
              <Input
                id={`data-${lancamento.id}`}
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`banco-${lancamento.id}`}>Banco (opcional)</Label>
              <Input
                id={`banco-${lancamento.id}`}
                list={ID_LISTA_BANCOS}
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                placeholder="Ex.: Banco do Brasil"
                className="uppercase"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmando(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
