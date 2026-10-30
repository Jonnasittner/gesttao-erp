"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLinkIcon, Loader2Icon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { procurarCobrancasNoAsaas, vincularCobrancasDoAsaas } from "@/server/asaas";
import type { BuscaVinculosAsaas, CobrancaEncontradaAsaas, ParcelaLivreAsaas } from "@/lib/asaas";
import { formatarMoeda } from "@/lib/moeda";
import { formatarDataISO } from "@/lib/datetime";
import { desembrulhar } from "@/lib/resultado";
import { rotuloDocumento } from "@/lib/financeiro";

const ROTULOS_STATUS: Record<string, string> = {
  PENDING: "Aguardando",
  OVERDUE: "Vencida",
  RECEIVED: "Recebida",
  CONFIRMED: "Confirmada",
  RECEIVED_IN_CASH: "Recebida fora do Asaas",
};

const ROTULOS_FORMA: Record<string, string> = {
  BOLETO: "Boleto",
  PIX: "Pix",
  CREDIT_CARD: "Cartão",
  UNDEFINED: "Link",
};

function rotuloParcela(p: ParcelaLivreAsaas, comCliente: boolean) {
  const partes = [
    comCliente ? p.clienteNome : "",
    `Doc. ${rotuloDocumento(p.numeroDocumento, p.parcela, p.totalParcelas)}`,
    formatarMoeda(p.valor),
    `vence ${formatarDataISO(p.vencimento)}`,
    p.status === "PAGO" ? "recebida" : "",
    p.trocaVencimento ? `ligada hoje ao boleto de ${formatarDataISO(p.trocaVencimento)}` : "",
  ];
  return partes.filter(Boolean).join(" · ");
}

/**
 * Botão "Buscar no Asaas" de Contas a receber: lista todas as cobranças do
 * Asaas sem vínculo e deixa escolher, para cada uma, a parcela do sistema a
 * que se refere. A sugestão de mesmo vencimento (pelo CPF/CNPJ) já vem escolhida.
 */
export function VincularAsaas() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState<BuscaVinculosAsaas | null>(null);
  /** cobrança → parcela escolhida. */
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [filtro, setFiltro] = useState("");
  const [buscando, startBusca] = useTransition();
  const [vinculando, startVinculo] = useTransition();

  const parcelaPorId = useMemo(() => new Map(busca?.parcelas.map((p) => [p.id, p])), [busca]);

  function procurar() {
    setAberto(true);
    setBusca(null);
    setFiltro("");
    startBusca(async () => {
      try {
        const resultado = desembrulhar(await procurarCobrancasNoAsaas());
        setBusca(resultado);
        setEscolhas(
          Object.fromEntries(
            resultado.cobrancas.filter((c) => c.exato && c.sugestaoLancamentoId).map((c) => [c.id, c.sugestaoLancamentoId!])
          )
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao buscar no Asaas.");
        setAberto(false);
      }
    });
  }

  function escolher(cobrancaId: string, lancamentoId: string) {
    setEscolhas((atual) => {
      const nova = { ...atual };
      // Uma parcela só pode receber uma cobrança: tira de quem já tinha.
      for (const [outra, parcela] of Object.entries(nova)) if (parcela === lancamentoId) delete nova[outra];
      if (lancamentoId) nova[cobrancaId] = lancamentoId;
      else delete nova[cobrancaId];
      return nova;
    });
  }

  function vincular() {
    const pares = Object.entries(escolhas).map(([cobrancaId, lancamentoId]) => ({ cobrancaId, lancamentoId }));
    startVinculo(async () => {
      try {
        const total = desembrulhar(await vincularCobrancasDoAsaas(pares));
        toast.success(total === 1 ? "1 cobrança vinculada." : `${total} cobranças vinculadas.`);
        setAberto(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao vincular.");
      }
    });
  }

  const termo = filtro.trim().toLowerCase();
  const visiveis = (busca?.cobrancas ?? []).filter((c) => {
    if (!termo) return true;
    const parcela = parcelaPorId.get(escolhas[c.id] ?? "");
    return [c.clienteNome, c.descricao, parcela?.clienteNome].some((t) => t?.toLowerCase().includes(termo));
  });
  const totalEscolhas = Object.keys(escolhas).length;

  return (
    <>
      <Button variant="outline" onClick={procurar} disabled={buscando} className="gap-1.5">
        {buscando ? <Loader2Icon className="animate-spin" /> : <SearchIcon />}
        Buscar no Asaas
      </Button>

      <Dialog open={aberto} onOpenChange={(abrir) => !vinculando && setAberto(abrir)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Cobranças do Asaas sem vínculo</DialogTitle>
            <DialogDescription>
              Escolha a parcela do sistema de cada cobrança. As de mesmo cliente (CPF/CNPJ) e mesmo vencimento já
              vêm escolhidas. Ao vincular, a parcela fica com o valor e o vencimento do Asaas; as já pagas lá viram
              &quot;Recebido&quot;.
            </DialogDescription>
          </DialogHeader>

          {!busca ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" /> Consultando o Asaas…
            </p>
          ) : busca.cobrancas.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Todas as cobranças do Asaas já estão vinculadas a parcelas do sistema.
            </p>
          ) : (
            <div className="flex min-h-0 flex-col gap-3">
              <Input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder={`Filtrar ${busca.cobrancas.length} cobranças por cliente ou descrição`}
              />
              <ul className="flex max-h-[55vh] flex-col divide-y overflow-y-auto rounded-lg border">
                {visiveis.map((c) => (
                  <LinhaCobranca
                    key={c.id}
                    cobranca={c}
                    parcelas={busca.parcelas}
                    escolhida={parcelaPorId.get(escolhas[c.id] ?? "") ?? null}
                    onEscolher={(id) => escolher(c.id, id)}
                  />
                ))}
                {visiveis.length === 0 && (
                  <li className="p-4 text-center text-sm text-muted-foreground">Nenhuma cobrança com esse filtro.</li>
                )}
              </ul>
              {busca.semDocumento.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Sem CPF/CNPJ no cadastro (a sugestão automática não acha): {busca.semDocumento.join(", ")}.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)} disabled={vinculando}>
              Fechar
            </Button>
            <Button onClick={vincular} disabled={!busca || totalEscolhas === 0 || vinculando} className="gap-1.5">
              {vinculando && <Loader2Icon className="animate-spin" />}
              Vincular {totalEscolhas > 0 ? totalEscolhas : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LinhaCobranca({
  cobranca: c,
  parcelas,
  escolhida,
  onEscolher,
}: {
  cobranca: CobrancaEncontradaAsaas;
  parcelas: ParcelaLivreAsaas[];
  escolhida: ParcelaLivreAsaas | null;
  onEscolher: (lancamentoId: string) => void;
}) {
  const sugerida = parcelas.find((p) => p.id === c.sugestaoLancamentoId);
  const doCliente = parcelas.filter((p) => c.cadastroId && p.clienteId === c.cadastroId && p.id !== sugerida?.id);
  const outras = parcelas.filter((p) => p.id !== sugerida?.id && !doCliente.includes(p));
  const muda =
    escolhida && (Math.round(escolhida.valor * 100) !== Math.round(c.valor * 100) || escolhida.vencimento !== c.vencimento);

  return (
    <li className={`grid gap-3 p-3 text-sm md:grid-cols-[1fr_1.3fr] ${escolhida ? "bg-emerald-50/60 dark:bg-emerald-950/20" : ""}`}>
      <div className="min-w-0">
        <p className="font-medium">{c.clienteNome}</p>
        <p className="flex flex-wrap items-center gap-1.5">
          <span>
            {ROTULOS_FORMA[c.billingType] ?? c.billingType} {formatarMoeda(c.valor)} · vence {formatarDataISO(c.vencimento)}
          </span>
          <Badge variant="outline">{ROTULOS_STATUS[c.status] ?? c.status}</Badge>
          <a
            href={c.link}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
            aria-label="Abrir no Asaas"
            title="Abrir no Asaas"
          >
            <ExternalLinkIcon className="size-3.5" />
          </a>
        </p>
        {c.descricao && <p className="truncate text-xs text-muted-foreground">{c.descricao}</p>}
        {!c.cadastroId && (
          <p className="text-xs text-amber-700 dark:text-amber-400">CPF/CNPJ não bate com nenhum cadastro do sistema.</p>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <select
          value={escolhida?.id ?? ""}
          onChange={(e) => onEscolher(e.target.value)}
          aria-label={`Parcela do sistema para a cobrança de ${c.clienteNome}`}
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">— Não vincular —</option>
          {sugerida && (
            <optgroup label={c.exato ? "Sugerida (mesmo vencimento)" : "Sugerida (só o valor bate)"}>
              <option value={sugerida.id}>{rotuloParcela(sugerida, false)}</option>
            </optgroup>
          )}
          {doCliente.length > 0 && (
            <optgroup label="Outras parcelas deste cliente">
              {doCliente.map((p) => (
                <option key={p.id} value={p.id}>
                  {rotuloParcela(p, false)}
                </option>
              ))}
            </optgroup>
          )}
          {outras.length > 0 && (
            <optgroup label="Parcelas de outros clientes">
              {outras.map((p) => (
                <option key={p.id} value={p.id}>
                  {rotuloParcela(p, true)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {muda && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            A parcela passa a {formatarMoeda(c.valor)} com vencimento {formatarDataISO(c.vencimento)} (dados do boleto).
          </p>
        )}
        {escolhida?.trocaVencimento && (
          <p className="text-xs text-sky-700 dark:text-sky-400">
            Corrige o vínculo atual com o boleto de {formatarDataISO(escolhida.trocaVencimento)}.
          </p>
        )}
      </div>
    </li>
  );
}
