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
import { ExcluirPedidoBotao } from "@/components/pedidos/excluir-pedido-botao";
import { listarPedidos } from "@/server/pedidos";
import { listarProdutos } from "@/server/produtos";
import { listarCadastros } from "@/server/cadastros";
import { formatarCodigo } from "@/lib/codigo";
import { formatarMoeda } from "@/lib/moeda";

export default async function PedidosPage() {
  const [pedidos, clientes, produtos] = await Promise.all([
    listarPedidos(),
    listarCadastros("CLIENTE"),
    listarProdutos(),
  ]);

  const opcoesClientes = clientes.map((c) => ({ value: c.id, label: c.nome }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pedidos</h1>
        <NovoPedidoDialog clientes={opcoesClientes} produtosIniciais={produtos} />
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
            {pedidos.map((pedido) => (
              <TableRow key={pedido.id}>
                <TableCell>
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-100 font-mono text-blue-800 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                  >
                    {formatarCodigo(pedido.numero)}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/pedidos/${pedido.id}`} className="hover:underline">
                    {pedido.cadastroNome}
                  </Link>
                </TableCell>
                <TableCell>
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
                  <ExcluirPedidoBotao id={pedido.id} numero={formatarCodigo(pedido.numero)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
