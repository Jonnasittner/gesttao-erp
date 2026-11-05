"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cliqueEmControle } from "@/components/financeiro/detalhe-lancamento";
import { formatarCodigo } from "@/lib/codigo";
import { formatarMoeda } from "@/lib/moeda";
import type { Pedido } from "@/lib/types";

/**
 * Linha (tabela) ou cartão (celular) de um pedido/orçamento que, ao ser
 * clicado, abre o pop-up com os itens. Os itens já vêm no pedido, então
 * nada é buscado no Firestore ao abrir. Cliques em links e botões da linha
 * (editar, converter, excluir) continuam sendo deles.
 */
export function PedidoClicavel({
  pedido,
  cidade,
  dataHora,
  margem,
  como,
  className,
  children,
}: {
  pedido: Pedido;
  cidade: string;
  /** Já formatada no servidor, no horário de Brasília. */
  dataHora: string;
  /** Margem calculada no servidor (só faz sentido para pedido). */
  margem?: React.ReactNode;
  como: "linha" | "cartao";
  className?: string;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const isPedido = pedido.status === "PEDIDO";

  function abrir(e: React.MouseEvent) {
    if (cliqueEmControle(e)) return;
    setAberto(true);
  }

  const props = { onClick: abrir, className: `cursor-pointer ${className ?? ""}`, title: "Ver itens" };

  return (
    <>
      {como === "linha" ? <TableRow {...props}>{children}</TableRow> : <div {...props}>{children}</div>}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {isPedido ? "Pedido" : "Orçamento"} {formatarCodigo(pedido.numero)} · {pedido.cadastroNome}
            </DialogTitle>
            <DialogDescription>
              {[dataHora, cidade, `${pedido.itens.length} ${pedido.itens.length === 1 ? "item" : "itens"}`, formatarMoeda(pedido.total)]
                .filter(Boolean)
                .join(" · ")}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Produto</th>
                  <th className="px-3 py-2 text-right font-medium">Qtd.</th>
                  <th className="px-3 py-2 text-right font-medium">Medidas</th>
                  <th className="px-3 py-2 text-right font-medium">Unitário</th>
                  <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pedido.itens.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      Nenhum item.
                    </td>
                  </tr>
                )}
                {pedido.itens.map((item, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{item.produtoNome}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.quantidade.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-muted-foreground">
                      {item.comprimento || item.largura
                        ? `${item.comprimento.toLocaleString("pt-BR")} × ${item.largura.toLocaleString("pt-BR")} cm`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatarMoeda(item.precoUnitario)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatarMoeda(item.quantidade * item.precoUnitario)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td colSpan={4} className="px-3 py-2 text-right font-medium">
                    Total {isPedido ? "do pedido" : "do orçamento"}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatarMoeda(pedido.total)}</td>
                </tr>
              </tfoot>
            </table>
            {pedido.observacao && (
              <p className="border-t px-3 py-2 text-xs whitespace-pre-line text-muted-foreground">{pedido.observacao}</p>
            )}
          </div>

          <DialogFooter className="items-center">
            {isPedido && margem && (
              <span className="mr-auto text-sm">
                <span className="text-muted-foreground">Margem: </span>
                {margem}
              </span>
            )}
            <Button nativeButton={false} variant="outline" render={<Link href={`/pedidos/${pedido.id}`} />}>
              Abrir {isPedido ? "pedido" : "orçamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
