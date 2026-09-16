import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buscarPedido } from "@/server/pedidos";
import { buscarCadastro, listarCadastros } from "@/server/cadastros";
import { buscarProduto, listarProdutos } from "@/server/produtos";
import { ImagemProduto } from "@/components/produtos/imagem-produto";
import { ConverterPedidoBotao } from "@/components/pedidos/converter-pedido-botao";
import { EditarPedidoDialog } from "@/components/pedidos/editar-pedido-dialog";
import { BaixarPdfBotao } from "@/components/pedidos/baixar-pdf-botao";
import { FinanceiroPedido } from "@/components/pedidos/financeiro-pedido";
import { listarBancosUsados, listarLancamentosDoPedido } from "@/server/financeiro";
import { BANCOS_SUGERIDOS } from "@/lib/financeiro";
import { formatarCodigo } from "@/lib/codigo";
import { formatarMoeda } from "@/lib/moeda";

import { formatarCpfCnpj } from "@/lib/documento";

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pedido = await buscarPedido(id);
  if (!pedido) notFound();

  const isPedido = pedido.status === "PEDIDO";
  const codigoFormatado = formatarCodigo(pedido.numero);

  const [cliente, todosClientes, todosProdutos, lancamentos, bancosUsados] = await Promise.all([
    buscarCadastro(pedido.cadastroId),
    listarCadastros("CLIENTE"),
    listarProdutos(),
    listarLancamentosDoPedido(pedido.id),
    listarBancosUsados(),
  ]);

  const opcoesClientes = todosClientes.map((c) => ({ value: c.id, label: c.nome }));

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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {isPedido ? "Pedido" : "Orçamento"} {codigoFormatado}
            </h1>
            <Badge
              variant="outline"
              className={
                isPedido
                  ? "border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/40 dark:text-green-300"
                  : "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
              }
            >
              {isPedido ? "Pedido" : "Orçamento"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EditarPedidoDialog
            pedido={pedido}
            clientes={opcoesClientes}
            produtosIniciais={todosProdutos}
            trigger={
              <Button type="button" variant="outline">
                <PencilIcon /> Editar
              </Button>
            }
          />
          {!isPedido && (
            <ConverterPedidoBotao id={pedido.id} numero={codigoFormatado} showText={true} />
          )}
          <BaixarPdfBotao
            pedidoId={pedido.id}
            nomeArquivo={`${isPedido ? "pedido" : "orcamento"}-${codigoFormatado}.pdf`}
            titulo={`${isPedido ? "Pedido" : "Orçamento"} ${codigoFormatado}`}
          />
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Cliente</h2>
        <p className="font-medium">{pedido.cadastroNome}</p>
        {cliente?.documento && (
          <p className="text-sm text-muted-foreground">CNPJ/CPF: {formatarCpfCnpj(cliente.documento)}</p>
        )}
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

      {pedido.observacao && (
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Observações</h2>
          <p className="text-sm whitespace-pre-line">{pedido.observacao}</p>
        </div>
      )}

      <FinanceiroPedido
        pedido={pedido}
        lancamentos={lancamentos}
        sugestoesBanco={[...new Set([...bancosUsados, ...BANCOS_SUGERIDOS])]}
      />
    </div>
  );
}
