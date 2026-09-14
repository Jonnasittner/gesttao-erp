"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { NovoProdutoDialog, type ProdutoOpcao } from "@/components/pedidos/novo-produto-dialog";
import { ImagemProduto } from "@/components/produtos/imagem-produto";
import { PreviaPdfBotao } from "@/components/pedidos/previa-pdf-botao";
import { atualizarPedido } from "@/server/pedidos";
import { pedidoSchema, type Pedido, type Produto } from "@/lib/types";
import { formatarMoeda } from "@/lib/moeda";
import { formatarCodigo } from "@/lib/codigo";

type ClienteOpcao = { value: string; label: string };

interface ItemForm {
  chave: string;
  produto: ProdutoOpcao | null;
  quantidade: string;
  comprimento: string;
  largura: string;
  precoUnitario: string;
}

function itemVazio(): ItemForm {
  return {
    chave: crypto.randomUUID(),
    produto: null,
    quantidade: "1",
    comprimento: "",
    largura: "",
    precoUnitario: "",
  };
}

export function EditarPedidoDialog({
  pedido,
  clientes,
  produtosIniciais,
  trigger,
}: {
  pedido: Pedido;
  clientes: ClienteOpcao[];
  produtosIniciais: Produto[];
  trigger?: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [produtos, setProdutos] = useState<ProdutoOpcao[]>(
    produtosIniciais.map((p) => ({
      value: p.id,
      label: p.nome,
      preco: p.preco,
      custoM2: p.custoM2,
      imagemUrl: p.imagemUrl,
    }))
  );

  function MapearItensIniciais(): ItemForm[] {
    if (!pedido.itens || pedido.itens.length === 0) return [itemVazio()];
    return pedido.itens.map((item) => {
      const prodEncontrado = produtos.find((p) => p.value === item.produtoId);
      const prodOpcao: ProdutoOpcao = prodEncontrado ?? {
        value: item.produtoId,
        label: item.produtoNome,
        preco: item.precoUnitario,
        custoM2: 0,
        imagemUrl: "",
      };
      return {
        chave: crypto.randomUUID(),
        produto: prodOpcao,
        quantidade: String(item.quantidade),
        comprimento: item.comprimento ? String(item.comprimento) : "",
        largura: item.largura ? String(item.largura) : "",
        precoUnitario: String(item.precoUnitario),
      };
    });
  }

  const clienteInicial = clientes.find((c) => c.value === pedido.cadastroId) ?? {
    value: pedido.cadastroId,
    label: pedido.cadastroNome,
  };

  const [cliente, setCliente] = useState<ClienteOpcao | null>(clienteInicial);
  const [itens, setItens] = useState<ItemForm[]>(MapearItensIniciais);
  const [observacao, setObservacao] = useState(pedido.observacao ?? "");

  const total = itens.reduce(
    (soma, item) => soma + (Number(item.quantidade) || 0) * (Number(item.precoUnitario) || 0),
    0
  );

  function resetarComDadosDoPedido() {
    setCliente(
      clientes.find((c) => c.value === pedido.cadastroId) ?? {
        value: pedido.cadastroId,
        label: pedido.cadastroNome,
      }
    );
    setItens(MapearItensIniciais());
    setObservacao(pedido.observacao ?? "");
  }

  function atualizarItem(chave: string, patch: Partial<ItemForm>) {
    setItens((atual) => atual.map((item) => (item.chave === chave ? { ...item, ...patch } : item)));
  }

  function removerItem(chave: string) {
    setItens((atual) => (atual.length > 1 ? atual.filter((item) => item.chave !== chave) : atual));
  }

  function montarDados() {
    const parsed = pedidoSchema.safeParse({
      cadastroId: cliente?.value ?? "",
      cadastroNome: cliente?.label ?? "",
      itens: itens.map((item) => ({
        produtoId: item.produto?.value ?? "",
        produtoNome: item.produto?.label ?? "",
        quantidade: item.quantidade,
        comprimento: item.comprimento,
        largura: item.largura,
        precoUnitario: item.precoUnitario,
      })),
      observacao,
      status: pedido.status,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return null;
    }
    return parsed.data;
  }

  function handleSubmit() {
    const dados = montarDados();
    if (!dados) return;

    startTransition(async () => {
      try {
        await atualizarPedido(pedido.id, dados);
        const tipoDesc = pedido.status === "PEDIDO" ? "Pedido" : "Orçamento";
        toast.success(`${tipoDesc} #${formatarCodigo(pedido.numero)} atualizado.`);
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao atualizar orçamento.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetarComDadosDoPedido();
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button type="button" variant="ghost" size="icon-sm" title="Editar">
              <PencilIcon />
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Editar {pedido.status === "PEDIDO" ? "pedido" : "orçamento"} #{formatarCodigo(pedido.numero)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <Label>Cliente</Label>
            <Combobox items={clientes} value={cliente} onValueChange={(v) => setCliente(v)}>
              <ComboboxInput placeholder="Buscar cliente..." showClear />
              <ComboboxContent>
                <ComboboxEmpty>Nenhum cliente encontrado.</ComboboxEmpty>
                <ComboboxList>
                  {(item: ClienteOpcao) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Produtos</Label>
              <div className="flex gap-2">
                <NovoProdutoDialog onSalvo={(opcao) => setProdutos((atual) => [...atual, opcao])} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setItens((a) => [...a, itemVazio()])}
                >
                  <PlusIcon /> Adicionar produto
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {itens.map((item) => {
                const quantidade = Number(item.quantidade) || 0;
                const precoUnitario = Number(item.precoUnitario) || 0;
                const subtotal = quantidade * precoUnitario;
                const areaUnidade =
                  ((Number(item.comprimento) || 0) / 100) * ((Number(item.largura) || 0) / 100);
                const m2Total = areaUnidade * quantidade;
                const custoTotalItem = areaUnidade * (item.produto?.custoM2 ?? 0) * quantidade;
                const markupRs = subtotal - custoTotalItem;
                const markupPct = custoTotalItem > 0 ? (markupRs / custoTotalItem) * 100 : 0;

                return (
                  <div key={item.chave} className="flex flex-col gap-2 rounded-lg border p-3">
                    <div className="flex items-start gap-2">
                      {item.produto?.imagemUrl && (
                        <ImagemProduto url={item.produto.imagemUrl} alt={item.produto.label} />
                      )}
                      <div className="flex-1">
                        <Combobox
                          items={produtos}
                          value={item.produto}
                          onValueChange={(v) =>
                            atualizarItem(item.chave, {
                              produto: v,
                              precoUnitario: v ? String(v.preco) : item.precoUnitario,
                            })
                          }
                        >
                          <ComboboxInput placeholder="Buscar produto..." showClear />
                          <ComboboxContent>
                            <ComboboxEmpty>Nenhum produto encontrado.</ComboboxEmpty>
                            <ComboboxList>
                              {(opcao: ProdutoOpcao) => (
                                <ComboboxItem key={opcao.value} value={opcao}>
                                  {opcao.label}
                                </ComboboxItem>
                              )}
                            </ComboboxList>
                          </ComboboxContent>
                        </Combobox>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removerItem(item.chave)}
                        disabled={itens.length === 1}
                      >
                        <TrashIcon />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Comprimento (cm)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.comprimento}
                          onChange={(e) => atualizarItem(item.chave, { comprimento: e.target.value })}
                          className="h-8"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Largura (cm)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.largura}
                          onChange={(e) => atualizarItem(item.chave, { largura: e.target.value })}
                          className="h-8"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Quantidade</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantidade}
                          onChange={(e) => atualizarItem(item.chave, { quantidade: e.target.value })}
                          className="h-8"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">Preço unitário (R$)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.precoUnitario}
                          onChange={(e) => atualizarItem(item.chave, { precoUnitario: e.target.value })}
                          className="h-8"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        M²:{" "}
                        {m2Total.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span>Custo total: {formatarMoeda(custoTotalItem)}</span>
                      <span>
                        Markup: {markupPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% (
                        {formatarMoeda(markupRs)})
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        Subtotal: {formatarMoeda(subtotal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-3 text-base font-semibold">
            <span>Total</span>
            <span>{formatarMoeda(total)}</span>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="observacaoPedidoEdit">Observações</Label>
            <Textarea
              id="observacaoPedidoEdit"
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="uppercase"
            />
          </div>
        </div>

        <DialogFooter>
          <PreviaPdfBotao
            montarDados={montarDados}
            numero={pedido.numero}
            createdAt={pedido.createdAt}
            onSalvar={handleSubmit}
            salvando={isPending}
            textoSalvar="Salvar alterações"
          />
          <Button type="button" disabled={isPending} onClick={handleSubmit}>
            {isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
