import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buscarPedido } from "@/server/pedidos";
import { buscarCadastro } from "@/server/cadastros";
import { buscarProduto } from "@/server/produtos";
import { ImagemProduto } from "@/components/produtos/imagem-produto";
import { formatarCodigo } from "@/lib/codigo";
import { formatarMoeda } from "@/lib/moeda";

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pedido = await buscarPedido(id);
  if (!pedido) notFound();

  const cliente = await buscarCadastro(pedido.cadastroId);
  const enderecoCliente = cliente
    ? [cliente.endereco, cliente.numero, cliente.bairro, cliente.cidade, cliente.estado]
        .filter(Boolean)
        .join(", ")
    : "";

  const produtoIds = [...new Set(pedido.itens.map((item) => item.produtoId).filter(Boolean))];
  const produtos = await Promise.all(produtoIds.map((produtoId) => buscarProduto(produtoId)));
  const imagemPorProdutoId = new Map(
    produtos.filter((p) => p !== null).map((p) => [p.id, p.imagemUrl])
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/pedidos"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            <ArrowLeftIcon className="size-3.5" /> Pedidos
          </Link>
          <h1 className="text-2xl font-semibold">Orçamento {formatarCodigo(pedido.numero)}</h1>
        </div>
        <Button
          nativeButton={false}
          render={
            <a href={`/api/pedidos/${pedido.id}/pdf`} download={`orcamento-${formatarCodigo(pedido.numero)}.pdf`}>
              <DownloadIcon /> Baixar PDF
            </a>
          }
        />
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Cliente</h2>
        <p className="font-medium">{pedido.cadastroNome}</p>
        {cliente?.documento && <p className="text-sm text-muted-foreground">Documento: {cliente.documento}</p>}
        {cliente?.telefone && <p className="text-sm text-muted-foreground">Telefone: {cliente.telefone}</p>}
        {enderecoCliente && <p className="text-sm text-muted-foreground">{enderecoCliente}</p>}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-0">Imagem</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Medida</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Preço unitário</TableHead>
              <TableHead>Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pedido.itens.map((item, index) => {
              const imagemUrl = imagemPorProdutoId.get(item.produtoId);
              return (
              <TableRow key={index}>
                <TableCell>
                  {imagemUrl ? (
                    <ImagemProduto url={imagemUrl} alt={item.produtoNome} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">{item.produtoNome}</TableCell>
                <TableCell>
                  {item.comprimento && item.largura ? `${item.comprimento}x${item.largura}cm` : "—"}
                </TableCell>
                <TableCell>{item.quantidade}</TableCell>
                <TableCell>{formatarMoeda(item.precoUnitario)}</TableCell>
                <TableCell>{formatarMoeda(item.quantidade * item.precoUnitario)}</TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-2 border-t pt-3 text-lg font-semibold">
        <span>Total</span>
        <span>{formatarMoeda(pedido.total)}</span>
      </div>
    </div>
  );
}
