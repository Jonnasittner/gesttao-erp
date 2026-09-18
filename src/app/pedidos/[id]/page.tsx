import { notFound } from "next/navigation";
import { PencilIcon } from "lucide-react";
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
import { FotosPedido } from "@/components/pedidos/fotos-pedido";
import { listarBancosUsados, listarLancamentosDoPedido } from "@/server/financeiro";
import { BANCOS_SUGERIDOS, calcularCustoProdutos } from "@/lib/financeiro";
import { formatarCodigo } from "@/lib/codigo";
import { PageHeader } from "@/components/ui/page-header";
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
    <div className="flex flex-col gap-5">
      <PageHeader
        voltar={{ href: "/pedidos", label: "Pedidos" }}
        titulo={`${isPedido ? "Pedido" : "Orçamento"} ${codigoFormatado}`}
        descricao={`Criado em ${new Date(pedido.createdAt).toLocaleDateString("pt-BR")}`}
        selo={
          <Badge
            variant="outline"
            className={
              isPedido
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
            }
          >
            {isPedido ? "Pedido" : "Orçamento"}
          </Badge>
        }
        acoes={
          <>
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
          </>
        }
      />

      <div className="superficie p-5">
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Cliente</h2>
        <p className="font-medium">{pedido.cadastroNome}</p>
        {cliente?.documento && (
          <p className="text-sm text-muted-foreground">CNPJ/CPF: {formatarCpfCnpj(cliente.documento)}</p>
        )}
        {cliente?.telefone && <p className="text-sm text-muted-foreground">Telefone: {cliente.telefone}</p>}
        {enderecoCliente && <p className="text-sm text-muted-foreground">{enderecoCliente}</p>}
      </div>

      <div className="superficie overflow-x-auto">
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

      <div className="superficie flex items-center justify-end gap-3 px-5 py-3">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="text-xl font-semibold tabular-nums">{formatarMoeda(pedido.total)}</span>
      </div>

      <FotosPedido pedidoId={pedido.id} fotos={pedido.fotos} />

      {pedido.observacao && (
        <div className="superficie p-5">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Observações</h2>
          <p className="text-sm whitespace-pre-line">{pedido.observacao}</p>
        </div>
      )}

      <FinanceiroPedido
        pedido={pedido}
        lancamentos={lancamentos}
        sugestoesBanco={[...new Set([...bancosUsados, ...BANCOS_SUGERIDOS])]}
        custoCalculado={calcularCustoProdutos(
          pedido.itens,
          new Map(todosProdutos.map((p) => [p.id, p.custoM2]))
        )}
      />
    </div>
  );
}
