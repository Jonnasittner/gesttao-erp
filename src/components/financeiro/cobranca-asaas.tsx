"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BarcodeIcon,
  CopyIcon,
  ExternalLinkIcon,
  LinkIcon,
  Loader2Icon,
  QrCodeIcon,
  RefreshCwIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { detalharCobrancaAsaas, excluirCobrancaAsaas, gerarCobrancaAsaas } from "@/server/asaas";
import { formatarMoeda } from "@/lib/moeda";
import { formatarDataISO } from "@/lib/datetime";
import { desembrulhar } from "@/lib/resultado";
import type { CobrancaAsaas, Lancamento, TipoCobrancaAsaas } from "@/lib/types";

const ROTULOS_STATUS: Record<string, string> = {
  PENDING: "Aguardando pagamento",
  OVERDUE: "Vencida",
  RECEIVED: "Recebida",
  CONFIRMED: "Confirmada",
  RECEIVED_IN_CASH: "Recebida fora do Asaas",
  REFUNDED: "Estornada",
  REFUND_REQUESTED: "Estorno solicitado",
  CHARGEBACK_REQUESTED: "Chargeback",
  AWAITING_RISK_ANALYSIS: "Em análise",
};

const OPCOES: { tipo: TipoCobrancaAsaas; titulo: string; detalhe: string; icone: React.ReactNode }[] = [
  { tipo: "PIX", titulo: "Pix", detalhe: "QR Code e copia-e-cola", icone: <QrCodeIcon className="size-5" /> },
  { tipo: "BOLETO", titulo: "Boleto", detalhe: "PDF e linha digitável (também aceita Pix)", icone: <BarcodeIcon className="size-5" /> },
  { tipo: "UNDEFINED", titulo: "Link de pagamento", detalhe: "O cliente escolhe: Pix, boleto ou cartão", icone: <LinkIcon className="size-5" /> },
];

interface Detalhes {
  cobranca: CobrancaAsaas;
  pixCopiaECola: string;
  pixQrCodeBase64: string;
  pixErro: string;
  linhaDigitavel: string;
}

async function copiar(texto: string, rotulo: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(`${rotulo} copiado.`);
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

function CampoCopiavel({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/40 px-2 py-1.5 text-xs">{valor}</code>
        <Button type="button" variant="outline" size="icon-sm" onClick={() => copiar(valor, rotulo)} aria-label={`Copiar ${rotulo}`}>
          <CopyIcon />
        </Button>
      </div>
    </div>
  );
}

/** Botão "Cobrar" da parcela a receber: gera e mostra a cobrança do Asaas. */
export function CobrancaAsaasBotao({ lancamento, documento }: { lancamento: Lancamento; documento: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [detalhes, setDetalhes] = useState<Detalhes | null>(null);
  const [isPending, startTransition] = useTransition();
  const cobranca = detalhes?.cobranca ?? lancamento.asaas;

  function carregar() {
    startTransition(async () => {
      try {
        setDetalhes(desembrulhar(await detalharCobrancaAsaas(lancamento.id)));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao consultar o Asaas.");
      }
    });
  }

  function abrir() {
    setAberto(true);
    setDetalhes(null);
    if (lancamento.asaas) carregar();
  }

  function gerar(tipo: TipoCobrancaAsaas) {
    startTransition(async () => {
      try {
        desembrulhar(await gerarCobrancaAsaas(lancamento.id, tipo));
        toast.success("Cobrança gerada no Asaas.");
        setDetalhes(desembrulhar(await detalharCobrancaAsaas(lancamento.id)));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao gerar a cobrança.");
      }
    });
  }

  function cancelar() {
    if (!confirm("Cancelar esta cobrança no Asaas? O link, o Pix e o boleto deixam de valer.")) return;
    startTransition(async () => {
      try {
        desembrulhar(await excluirCobrancaAsaas(lancamento.id));
        toast.success("Cobrança cancelada.");
        setDetalhes(null);
        setAberto(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao cancelar a cobrança.");
      }
    });
  }

  const textoWhatsApp = cobranca
    ? `Olá! Segue o link para pagamento de ${formatarMoeda(cobranca.valor)} (vencimento ${formatarDataISO(cobranca.vencimento)}): ${cobranca.linkPagamento}`
    : "";

  return (
    <>
      <Button
        type="button"
        variant={lancamento.asaas ? "secondary" : "outline"}
        size="sm"
        onClick={abrir}
        title={lancamento.asaas ? ROTULOS_STATUS[lancamento.asaas.status] ?? lancamento.asaas.status : "Gerar boleto, Pix ou link"}
      >
        <QrCodeIcon /> {lancamento.asaas ? "Cobrança" : "Cobrar"}
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Cobrança · {documento}
              {cobranca?.ambiente === "sandbox" && (
                <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400">
                  Teste
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {lancamento.clienteNome} · {formatarMoeda(lancamento.valor)} · vence {formatarDataISO(lancamento.vencimento)}
            </DialogDescription>
          </DialogHeader>

          {!cobranca ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Como o cliente vai pagar?</p>
              {OPCOES.map((o) => (
                <button
                  key={o.tipo}
                  type="button"
                  disabled={isPending}
                  onClick={() => gerar(o.tipo)}
                  className="flex items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                >
                  <span className="text-primary">{o.icone}</span>
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{o.titulo}</span>
                    <span className="text-xs text-muted-foreground">{o.detalhe}</span>
                  </span>
                </button>
              ))}
              {isPending && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2Icon className="size-3.5 animate-spin" /> Gerando no Asaas...
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary">{ROTULOS_STATUS[cobranca.status] ?? cobranca.status}</Badge>
                <Button type="button" variant="ghost" size="sm" onClick={carregar} disabled={isPending}>
                  {isPending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />} Atualizar
                </Button>
              </div>

              {detalhes?.pixQrCodeBase64 && (
                <div className="flex flex-col items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- imagem base64 vinda do Asaas */}
                  <img
                    src={`data:image/png;base64,${detalhes.pixQrCodeBase64}`}
                    alt="QR Code Pix"
                    className="size-48 rounded-lg border bg-white p-2"
                  />
                </div>
              )}
              {detalhes?.pixErro && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  Pix indisponível: {detalhes.pixErro} O link de pagamento abaixo continua valendo.
                </p>
              )}
              {detalhes?.pixCopiaECola && <CampoCopiavel rotulo="Pix copia-e-cola" valor={detalhes.pixCopiaECola} />}
              {detalhes?.linhaDigitavel && <CampoCopiavel rotulo="Linha digitável do boleto" valor={detalhes.linhaDigitavel} />}
              <CampoCopiavel rotulo="Link de pagamento" valor={cobranca.linkPagamento} />

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<a href={`https://wa.me/?text=${encodeURIComponent(textoWhatsApp)}`} target="_blank" rel="noreferrer" />}
                >
                  <SendIcon /> Enviar no WhatsApp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<a href={cobranca.linkPagamento} target="_blank" rel="noreferrer" />}
                >
                  <ExternalLinkIcon /> Abrir
                </Button>
                {cobranca.linkBoleto && (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<a href={cobranca.linkBoleto} target="_blank" rel="noreferrer" />}
                  >
                    <BarcodeIcon /> Boleto (PDF)
                  </Button>
                )}
              </div>

              {!["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(cobranca.status) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={cancelar}
                  disabled={isPending}
                  className="self-start text-rose-700 hover:text-rose-800 dark:text-rose-400"
                >
                  <Trash2Icon /> Cancelar cobrança
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
