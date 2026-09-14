import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { NovoPedidoDialog } from "@/components/pedidos/novo-pedido-dialog";
import { EditarPedidoDialog } from "@/components/pedidos/editar-pedido-dialog";
import { ExcluirPedidoBotao } from "@/components/pedidos/excluir-pedido-botao";
import { ConverterPedidoBotao } from "@/components/pedidos/converter-pedido-botao";
import { listarPedidos } from "@/server/pedidos";
import { listarProdutos } from "@/server/produtos";
import { listarCadastros } from "@/server/cadastros";
import { buscarEmpresa } from "@/server/empresa";
import { formatarCodigo } from "@/lib/codigo";
import { formatarMoeda } from "@/lib/moeda";

export default async function PedidosPage() {
  const [pedidos, clientes, produtos, empresa] = await Promise.all([
    listarPedidos(),
    listarCadastros("CLIENTE"),
    listarProdutos(),
    buscarEmpresa(),
  ]);

  const opcoesClientes = clientes.map((c) => ({ value: c.id, label: c.nome }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pedidos</h1>
        <NovoPedidoDialog
          clientes={opcoesClientes}
          produtosIniciais={produtos}
          observacaoPadrao={empresa?.observacaoPadraoPedido}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pedidos.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum pedido ou orçamento encontrado.
                </TableCell>
              </TableRow>
            )}
            {pedidos.map((pedido) => {
              const isPedido = pedido.status === "PEDIDO";
              const codigoFormatado = formatarCodigo(pedido.numero);

              return (
                <TableRow key={pedido.id}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        isPedido
                          ? "border-green-200 bg-green-100 font-mono text-green-800 dark:border-green-800 dark:bg-green-900/40 dark:text-green-300"
                          : "border-blue-200 bg-blue-100 font-mono text-blue-800 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                      }
                    >
                      {codigoFormatado}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/pedidos/${pedido.id}`} className="hover:underline">
                      {pedido.cadastroNome}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-normal min-w-[200px]">
                    {pedido.itens
                      .map((item) =>
                        item.comprimento && item.largura
                          ? `${item.produtoNome} (${item.quantidade}x, ${item.comprimento}x${item.largura}cm)`
                          : `${item.produtoNome} (${item.quantidade}x)`
                      )
                      .join(", ")}
                  </TableCell>
                  <TableCell>{formatarMoeda(pedido.total)}</TableCell>
                  <TableCell>{new Date(pedido.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <EditarPedidoDialog
                        pedido={pedido}
                        clientes={opcoesClientes}
                        produtosIniciais={produtos}
                      />
                      {!isPedido && (
                        <ConverterPedidoBotao
                          id={pedido.id}
                          numero={codigoFormatado}
                          size="sm"
                          showText={false}
                        />
                      )}
                      <ExcluirPedidoBotao id={pedido.id} numero={codigoFormatado} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
