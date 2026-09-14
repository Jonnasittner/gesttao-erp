import Link from "next/link";
import { 
  Clock,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardCards } from "@/components/dashboard/dashboard-cards";
import { listarPedidos } from "@/server/pedidos";
import { listarProdutos } from "@/server/produtos";
import { listarCadastros } from "@/server/cadastros";
import { listarInteracoes } from "@/server/crm";
import { formatarMoeda } from "@/lib/moeda";
import { formatarCodigo } from "@/lib/codigo";
import { ROTULOS_ETAPA_ATENDIMENTO, ROTULOS_TIPO_INTERACAO } from "@/lib/rotulos";

export default async function DashboardPage() {
  const [pedidos, produtos, cadastros, interacoes] = await Promise.all([
    listarPedidos(),
    listarProdutos(),
    listarCadastros(),
    listarInteracoes(),
  ]);

  const cadastroMap = new Map(cadastros.map((c) => [c.id, c.nome]));
  const ultimosPedidos = pedidos.slice(0, 5);
  const ultimasInteracoes = interacoes.slice(0, 5);

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Resumo de desempenho comercial e financeiro em tempo real. Clique em qualquer card para ver o detalhamento.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border dark:border-white/5">
          <Clock className="h-3.5 w-3.5" />
          <span>Sincronizado com o Banco de Dados</span>
        </div>
      </div>

      {/* Metrics Grid Clicável com Modal de Detalhamento */}
      <DashboardCards pedidos={pedidos} produtos={produtos} cadastros={cadastros} />

      {/* Main Grid: Details and Activity */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Recent Orders Preview Card */}
        <Card className="lg:col-span-4 border-muted">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold flex items-center justify-between">
              <span>Últimos Pedidos e Orçamentos</span>
              <Link href="/pedidos" className="text-xs text-primary hover:underline flex items-center gap-1">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </CardTitle>
            <CardDescription>Visualização dos registros mais recentes gravados no sistema.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Código</th>
                    <th className="px-4 py-3 font-semibold">Cliente</th>
                    <th className="px-4 py-3 font-semibold">Data</th>
                    <th className="px-4 py-3 font-semibold">Valor</th>
                    <th className="px-4 py-3 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ultimosPedidos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                        Nenhum pedido ou orçamento registrado ainda.
                      </td>
                    </tr>
                  ) : (
                    ultimosPedidos.map((p) => {
                      const isPedido = p.status === "PEDIDO";
                      const codigo = formatarCodigo(p.numero);
                      return (
                        <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-3.5">
                            <Badge
                              variant="outline"
                              className={
                                isPedido
                                  ? "border-green-200 bg-green-100 font-mono text-green-800 dark:border-green-800 dark:bg-green-900/40 dark:text-green-300 text-xs"
                                  : "border-blue-200 bg-blue-100 font-mono text-blue-800 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs"
                              }
                            >
                              {codigo}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 font-medium text-foreground">
                            <Link href={`/pedidos/${p.id}`} className="hover:underline">
                              {p.cadastroNome}
                            </Link>
                          </td>
                          <td className="px-4 py-3.5 text-muted-foreground text-xs">
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString("pt-BR") : "—"}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-foreground">
                            {formatarMoeda(p.total)}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <Badge
                              variant="outline"
                              className={
                                isPedido
                                  ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400 text-xs"
                                  : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400 text-xs"
                              }
                            >
                              {isPedido ? "Pedido" : "Orçamento"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* CRM Activity Card */}
        <Card className="lg:col-span-3 border-muted">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold flex items-center justify-between">
              <span>Atividades do CRM</span>
              <Link href="/crm" className="text-xs text-primary hover:underline flex items-center gap-1">
                Ver Board <ArrowRight className="h-3 w-3" />
              </Link>
            </CardTitle>
            <CardDescription>Últimas interações registradas no atendimento.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3.5">
              {ultimasInteracoes.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma interação registrada ainda no CRM.
                </div>
              ) : (
                ultimasInteracoes.map((item) => {
                  const nomeCliente = cadastroMap.get(item.cadastroId) || "Cliente";
                  const rotuloTipo = ROTULOS_TIPO_INTERACAO[item.tipo] || item.tipo;
                  const rotuloEtapa = ROTULOS_ETAPA_ATENDIMENTO[item.etapa] || item.etapa;

                  return (
                    <div key={item.id} className="flex gap-3 items-start border-b pb-3 last:border-0 last:pb-0">
                      <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{nomeCliente}</p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {item.data ? new Date(item.data).toLocaleDateString("pt-BR") : ""}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {item.descricao}
                        </p>
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            {rotuloTipo}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            {rotuloEtapa}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
