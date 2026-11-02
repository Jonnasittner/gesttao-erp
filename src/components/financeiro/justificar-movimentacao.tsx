"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, Loader2, RefreshCwIcon, SearchIcon, Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  atualizarExtrato,
  type ContaParaVincular,
  desfazerJustificativa,
  justificarMovimentacao,
  listarContasParaVincular,
  type PedidoJustificativa,
} from "@/server/conciliacao";
import { desembrulhar } from "@/lib/resultado";
import { formatarMoeda } from "@/lib/moeda";
import { formatarDataISO } from "@/lib/datetime";
import { ROTULOS_CATEGORIA_CUSTO } from "@/lib/rotulos";
import { cn } from "@/lib/utils";
import type { CategoriaCusto, MovimentacaoAsaas } from "@/lib/types";

/** Mercadoria fica de fora: pagamento a fornecedor vincula à conta a pagar dele. */
const CATEGORIAS_GASTO: CategoriaCusto[] = ["FRETE", "INSTALACAO", "COMISSAO", "OUTROS"];

type Modo = PedidoJustificativa["modo"];

export function JustificarMovimentacao({ movimentacao: m, resumo }: { movimentacao: MovimentacaoAsaas; resumo: string }) {
  const router = useRouter();
  const saida = m.valor < 0;
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<Modo>(saida ? "LANCADA" : "VINCULADA");
  const [categoria, setCategoria] = useState<CategoriaCusto | "">("");
  const [texto, setTexto] = useState("");
  const [pedidoNumero, setPedidoNumero] = useState("");
  const [contas, setContas] = useState<ContaParaVincular[] | null>(null);
  const [contaId, setContaId] = useState("");
  const [busca, setBusca] = useState("");
  const [carregandoContas, startContas] = useTransition();
  const [salvando, startSalvar] = useTransition();

  function abrir() {
    setModo(saida ? "LANCADA" : "VINCULADA");
    setCategoria("");
    setTexto("");
    setPedidoNumero("");
    setContaId("");
    setBusca("");
    setAberto(true);
    if (!saida) carregarContas();
  }

  function carregarContas() {
    if (contas) return;
    startContas(async () => {
      try {
        setContas(desembrulhar(await listarContasParaVincular(m.id)));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao buscar as contas.");
        setContas([]);
      }
    });
  }

  function trocarModo(novo: Modo) {
    setModo(novo);
    if (novo === "VINCULADA") carregarContas();
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    let pedido: PedidoJustificativa;
    if (modo === "VINCULADA") {
      if (!contaId) return toast.error(`Escolha a conta a ${saida ? "pagar" : "receber"}.`);
      pedido = { modo, lancamentoId: contaId, texto };
    } else if (modo === "LANCADA") {
      if (!categoria) return toast.error("Escolha o tipo do gasto.");
      const numero = Number(pedidoNumero.replace(/\D/g, ""));
      pedido = { modo, categoria, texto, pedidoNumero: numero || undefined };
    } else {
      if (!texto.trim()) return toast.error("Escreva o que foi esta movimentação.");
      pedido = { modo, texto };
    }
    startSalvar(async () => {
      try {
        desembrulhar(await justificarMovimentacao(m.id, pedido));
        toast.success("Movimentação justificada.");
        setAberto(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao justificar.");
      }
    });
  }

  const termo = busca.trim().toLowerCase();
  const contasFiltradas = (contas ?? []).filter(
    (c) => !termo || `${c.documento} ${c.nome} ${c.descricao}`.toLowerCase().includes(termo)
  );
  const opcoes: { modo: Modo; rotulo: string }[] = [
    ...(saida ? [{ modo: "LANCADA" as const, rotulo: "Lançar gasto" }] : []),
    { modo: "VINCULADA", rotulo: saida ? "Conta a pagar" : "Conta a receber" },
    { modo: "TEXTO", rotulo: "Só explicar" },
  ];

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={abrir}
        className="bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-400"
      >
        Justificar
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={salvar} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Justificar movimentação</DialogTitle>
              <DialogDescription>
                {formatarDataISO(m.data)} · {resumo}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1">
              {opcoes.map((o) => (
                <button
                  key={o.modo}
                  type="button"
                  onClick={() => trocarModo(o.modo)}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                    modo === o.modo
                      ? "bg-card text-foreground sombra-suave ring-1 ring-border"
                      : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                  )}
                >
                  {o.rotulo}
                </button>
              ))}
            </div>

            {modo === "LANCADA" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>Foi gasto com</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIAS_GASTO.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategoria(c)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-sm transition-colors",
                          categoria === c
                            ? "border-primary bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        )}
                      >
                        {ROTULOS_CATEGORIA_CUSTO[c]}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Vira um lançamento em Contas a pagar, já pago pelo Asaas. Pagamento de mercadoria a fornecedor: use
                    &quot;Conta a pagar&quot;.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`pedido-${m.id}`}>Pedido (opcional)</Label>
                  <Input
                    id={`pedido-${m.id}`}
                    inputMode="numeric"
                    value={pedidoNumero}
                    onChange={(e) => setPedidoNumero(e.target.value)}
                    placeholder="Ex.: 0123 — o custo entra na margem do pedido"
                  />
                </div>
              </>
            )}

            {modo === "VINCULADA" && (
              <div className="flex flex-col gap-1.5">
                <Label>Conta a {saida ? "pagar" : "receber"} em aberto</Label>
                <div className="relative">
                  <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por nome ou documento"
                    className="pl-8"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto rounded-lg border">
                  {carregandoContas || contas === null ? (
                    <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Buscando contas...
                    </p>
                  ) : contasFiltradas.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma conta em aberto.</p>
                  ) : (
                    contasFiltradas.map((c) => {
                      const mesmoValor = Math.round(c.valor * 100) === Math.round(Math.abs(m.valor) * 100);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setContaId(c.id)}
                          className={cn(
                            "flex w-full items-center gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted",
                            contaId === c.id && "bg-primary/10"
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              <span className="font-mono text-xs text-muted-foreground">{c.documento}</span> {c.nome}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              Vence {formatarDataISO(c.vencimento)}
                              {c.descricao && ` · ${c.descricao}`}
                            </span>
                          </span>
                          <span className={cn("shrink-0 tabular-nums", mesmoValor && "font-semibold text-emerald-700 dark:text-emerald-400")}>
                            {formatarMoeda(c.valor)}
                          </span>
                          {contaId === c.id && <CheckIcon className="size-4 shrink-0 text-primary" />}
                        </button>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground">A conta escolhida recebe a baixa com a data da movimentação.</p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`texto-${m.id}`}>{modo === "TEXTO" ? "O que foi" : "Observação (opcional)"}</Label>
              <Textarea
                id={`texto-${m.id}`}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={modo === "TEXTO" ? "Ex.: transferência para a conta do Banco do Brasil" : "Ex.: frete da entrega do pedido"}
                className="uppercase"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : "Justificar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DesfazerJustificativa({ movimentacaoId, aviso }: { movimentacaoId: string; aviso: string }) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  function desfazer() {
    if (!confirm(aviso)) return;
    startTransition(async () => {
      try {
        desembrulhar(await desfazerJustificativa(movimentacaoId));
        toast.success("A movimentação voltou para pendente.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao desfazer.");
      }
    });
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={pendente}
      onClick={desfazer}
      aria-label="Desfazer justificativa"
      title="Desfazer justificativa"
    >
      <Undo2Icon />
    </Button>
  );
}

export function AtualizarExtrato() {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  function atualizar() {
    startTransition(async () => {
      try {
        const novas = desembrulhar(await atualizarExtrato());
        toast.success(
          novas === 0 ? "Extrato em dia." : `${novas} ${novas === 1 ? "movimentação nova" : "movimentações novas"} para justificar.`
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao ler o extrato do Asaas.");
      }
    });
  }
  return (
    <Button type="button" variant="outline" onClick={atualizar} disabled={pendente}>
      <RefreshCwIcon className={cn(pendente && "animate-spin")} /> Atualizar extrato
    </Button>
  );
}
