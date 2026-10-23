"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BarcodeIcon, CopyIcon, Loader2Icon, SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { gerarCobrancasDoDocumento } from "@/server/asaas";
import { formatarMoeda } from "@/lib/moeda";
import { formatarDataISO } from "@/lib/datetime";
import { rotuloDocumento } from "@/lib/financeiro";
import type { Lancamento } from "@/lib/types";

/**
 * Boletos de todas as parcelas de um lançamento a receber: gera os que
 * faltam de uma vez e lista todos para mandar ao cliente.
 */
export function BoletosParcelas({ parcelas }: { parcelas: Lancamento[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [isPending, startTransition] = useTransition();

  const ordenadas = [...parcelas].sort((a, b) => a.parcela - b.parcela);
  const semCobranca = ordenadas.filter((p) => p.status !== "PAGO" && !p.asaas);
  const comCobranca = ordenadas.filter((p) => p.asaas);
  const numeroDocumento = ordenadas[0].numeroDocumento;

  function gerar() {
    const aviso = `Gerar ${semCobranca.length} ${semCobranca.length === 1 ? "boleto" : "boletos"} no Asaas, um por parcela, com o vencimento de cada uma?`;
    if (!confirm(aviso)) return;
    startTransition(async () => {
      try {
        const gerados = await gerarCobrancasDoDocumento(numeroDocumento, "BOLETO");
        toast.success(`${gerados} ${gerados === 1 ? "boleto gerado" : "boletos gerados"} no Asaas.`);
        setAberto(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao gerar os boletos.");
      } finally {
        router.refresh();
      }
    });
  }

  const textoWhatsApp = [
    "Olá! Seguem os boletos das parcelas:",
    ...comCobranca.map(
      (p) =>
        `${p.parcela}/${p.totalParcelas} - ${formatarMoeda(p.valor)} - vence ${formatarDataISO(p.asaas!.vencimento)}: ${p.asaas!.linkBoleto || p.asaas!.linkPagamento}`
    ),
  ].join("\n");

  async function copiarTudo() {
    try {
      await navigator.clipboard.writeText(textoWhatsApp);
      toast.success("Links copiados.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <>
      {semCobranca.length > 0 ? (
        <Button type="button" variant="outline" size="sm" onClick={gerar} disabled={isPending}>
          {isPending ? <Loader2Icon className="animate-spin" /> : <BarcodeIcon />}
          {isPending ? "Gerando..." : `Gerar boletos (${semCobranca.length})`}
        </Button>
      ) : (
        comCobranca.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => setAberto(true)}>
            <BarcodeIcon /> Boletos das parcelas
          </Button>
        )
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Boletos das parcelas</DialogTitle>
            <DialogDescription>
              {ordenadas[0].clienteNome} · {formatarMoeda(ordenadas[0].valorTotal)} em {ordenadas.length}×
            </DialogDescription>
          </DialogHeader>

          <ul className="divide-y rounded-xl border">
            {ordenadas.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-mono text-xs text-muted-foreground">
                    {rotuloDocumento(p.numeroDocumento, p.parcela, p.totalParcelas)}
                  </span>{" "}
                  <span className="font-medium tabular-nums">{formatarMoeda(p.valor)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p.status === "PAGO"
                      ? `Recebido em ${formatarDataISO(p.dataPagamento)}`
                      : `Vence ${formatarDataISO(p.asaas?.vencimento ?? p.vencimento)}`}
                  </span>
                </span>
                {p.asaas?.linkBoleto || p.asaas?.linkPagamento ? (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<a href={p.asaas.linkBoleto || p.asaas.linkPagamento} target="_blank" rel="noreferrer" />}
                  >
                    <BarcodeIcon /> {p.asaas.linkBoleto ? "PDF" : "Link"}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">{p.status === "PAGO" ? "—" : "Sem boleto"}</span>
                )}
              </li>
            ))}
          </ul>

          {comCobranca.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                nativeButton={false}
                render={<a href={`https://wa.me/?text=${encodeURIComponent(textoWhatsApp)}`} target="_blank" rel="noreferrer" />}
              >
                <SendIcon /> Enviar todos no WhatsApp
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={copiarTudo}>
                <CopyIcon /> Copiar links
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
