"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  DollarSign, 
  Users, 
  Package, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  FileText, 
  Percent, 
  Maximize2,
  ExternalLink,
  Search,
  Filter
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Pedido, Produto, Cadastro } from "@/lib/types";
import { formatarMoeda } from "@/lib/moeda";
import { formatarCodigo } from "@/lib/codigo";

interface DashboardCardsProps {
  pedidos: Pedido[];
  produtos: Produto[];
  cadastros: Cadastro[];
}

interface ItemDetalhamento {
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  comprimento: number;
  largura: number;
  areaM2: number;
  precoUnitario: number;
  subtotalVenda: number;
  custoM2: number;
  subtotalCusto: number;
  lucroItem: number;
  margemItemPct: number;
}

interface PedidoDetalhamento {
  id: string;
  numero: number;
  codigoFormatado: string;
  cadastroNome: string;
  createdAt: string;
  status: "ORCAMENTO" | "PEDIDO";
  faturamento: number;
  custoTotal: number;
  lucroTotal: number;
  margemPct: number;
  itens: ItemDetalhamento[];
}

interface ProdutoConsolidado {
  produtoId: string;
  nome: string;
  custoM2: number;
  quantidadeItens: number;
  m2TotalVendida: number;
  faturamentoTotal: number;
  custoTotal: number;
  lucroTotal: number;
  margemPct: number;
}

export function DashboardCards({ pedidos, produtos, cadastros }: DashboardCardsProps) {
  const [modalAberto, setModalAberto] = useState<"faturamento" | "lucro" | "orcamentos" | "produtos" | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<"pedidos" | "produtos">("pedidos");
  const [busca, setBusca] = useState("");

  const produtoMap = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);

  // Processa detalhamento de cada pedido e item
  const pedidosDetalhados = useMemo<PedidoDetalhamento[]>(() => {
    return pedidos.map((p) => {
      let custoTotalPedido = 0;

      const itensProcessados: ItemDetalhamento[] = p.itens.map((item) => {
        const prod = produtoMap.get(item.produtoId);
        const custoM2 = prod?.custoM2 ?? 0;

        const comp = item.comprimento || 0;
        const larg = item.largura || 0;
        const areaUnidade = comp && larg ? (comp / 100) * (larg / 100) : 1;
        const subtotalVenda = item.quantidade * item.precoUnitario;

        // Se tiver dimensões em cm, custo por m², senão custo direto por quantidade
        const subtotalCusto = comp && larg 
          ? areaUnidade * custoM2 * item.quantidade 
          : custoM2 * item.quantidade;

        const lucroItem = subtotalVenda - subtotalCusto;
        const margemItemPct = subtotalVenda > 0 ? (lucroItem / subtotalVenda) * 100 : 0;

        custoTotalPedido += subtotalCusto;

        return {
          produtoId: item.produtoId,
          produtoNome: item.produtoNome,
          quantidade: item.quantidade,
          comprimento: comp,
          largura: larg,
          areaM2: comp && larg ? areaUnidade * item.quantidade : 0,
          precoUnitario: item.precoUnitario,
          subtotalVenda,
          custoM2,
          subtotalCusto,
          lucroItem,
          margemItemPct,
        };
      });

      const faturamento = p.total;
      const lucroTotal = faturamento - custoTotalPedido;
      const margemPct = faturamento > 0 ? (lucroTotal / faturamento) * 100 : 0;

      return {
        id: p.id,
        numero: p.numero,
        codigoFormatado: formatarCodigo(p.numero),
        cadastroNome: p.cadastroNome,
        createdAt: p.createdAt,
        status: p.status ?? "ORCAMENTO",
        faturamento,
        custoTotal: custoTotalPedido,
        lucroTotal,
        margemPct,
        itens: itensProcessados,
      };
    });
  }, [pedidos, produtoMap]);

  // Consolidação de métricas por produto
  const produtosConsolidados = useMemo<ProdutoConsolidado[]>(() => {
    const mapa = new Map<string, ProdutoConsolidado>();

    for (const p of pedidosDetalhados) {
      // Considera apenas pedidos fechados para consolidação de produtos
      for (const item of p.itens) {
        const existente = mapa.get(item.produtoId) ?? {
          produtoId: item.produtoId,
          nome: item.produtoNome,
          custoM2: item.custoM2,
          quantidadeItens: 0,
          m2TotalVendida: 0,
          faturamentoTotal: 0,
          custoTotal: 0,
          lucroTotal: 0,
          margemPct: 0,
        };

        existente.quantidadeItens += item.quantidade;
        existente.m2TotalVendida += item.areaM2;
        existente.faturamentoTotal += item.subtotalVenda;
        existente.custoTotal += item.subtotalCusto;
        existente.lucroTotal += item.lucroItem;
        existente.margemPct = existente.faturamentoTotal > 0 
          ? (existente.lucroTotal / existente.faturamentoTotal) * 100 
          : 0;

        mapa.set(item.produtoId, existente);
      }
    }

    return Array.from(mapa.values()).sort((a, b) => b.faturamentoTotal - a.faturamentoTotal);
  }, [pedidosDetalhados]);

  // Métricas Totais
  const pedidosFechados = useMemo(
    () => pedidosDetalhados.filter((p) => p.status === "PEDIDO"),
    [pedidosDetalhados]
  );
  const orcamentosPendentes = useMemo(
    () => pedidosDetalhados.filter((p) => p.status === "ORCAMENTO"),
    [pedidosDetalhados]
  );

  const faturamentoTotal = useMemo(
    () => pedidosFechados.reduce((acc, p) => acc + p.faturamento, 0),
    [pedidosFechados]
  );
  const custoTotalFechados = useMemo(
    () => pedidosFechados.reduce((acc, p) => acc + p.custoTotal, 0),
    [pedidosFechados]
  );
  const lucroTotalFechados = faturamentoTotal - custoTotalFechados;
  // Markup: o lucro sobre o CUSTO (e não sobre a venda, que seria a margem).
  // null quando não há custo cadastrado nos produtos — aí não dá para calcular.
  const markupGeralPct = custoTotalFechados > 0 ? (lucroTotalFechados / custoTotalFechados) * 100 : null;

  const valorOrcamentosTotais = useMemo(
    () => orcamentosPendentes.reduce((acc, p) => acc + p.faturamento, 0),
    [orcamentosPendentes]
  );

  const clientesAtivos = useMemo(
    () => cadastros.filter((c) => c.tipos.includes("CLIENTE")).length,
    [cadastros]
  );

  // Filtragem na modal de acordo com busca do usuário
  const pedidosExibidosModal = useMemo(() => {
    const lista = modalAberto === "orcamentos" ? orcamentosPendentes : pedidosFechados;
    if (!busca.trim()) return lista;
    const term = busca.toLowerCase();
    return lista.filter(
      (p) =>
        p.cadastroNome.toLowerCase().includes(term) ||
        p.codigoFormatado.toLowerCase().includes(term) ||
        p.itens.some((i) => i.produtoNome.toLowerCase().includes(term))
    );
  }, [modalAberto, orcamentosPendentes, pedidosFechados, busca]);

  const produtosExibidosModal = useMemo(() => {
    if (!busca.trim()) return produtosConsolidados;
    const term = busca.toLowerCase();
    return produtosConsolidados.filter((p) => p.nome.toLowerCase().includes(term));
  }, [produtosConsolidados, busca]);

  return (
    <>
      {/* Grid dos Cards Interativos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Faturamento */}
        <Card
          onClick={() => {
            setAbaAtiva("pedidos");
            setModalAberto("faturamento");
          }}
          className="group relative cursor-pointer overflow-hidden border-muted bg-card transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
              Faturamento
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                Detalhar
              </span>
              <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/10 p-2 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarMoeda(faturamentoTotal)}</div>
            <div className="mt-1 flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{pedidosFechados.length} pedidos fechados</span>
              </div>
              <Maximize2 className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Lucro & Margem */}
        <Card
          onClick={() => {
            setAbaAtiva("pedidos");
            setModalAberto("lucro");
          }}
          className="group relative cursor-pointer overflow-hidden border-muted bg-card transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/5"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-violet-600 dark:group-hover:text-violet-400">
              Lucro Estimado
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                Detalhar
              </span>
              <div className="rounded-xl border border-violet-500/10 bg-violet-500/10 p-2 text-violet-500 group-hover:bg-violet-500 group-hover:text-white transition-colors">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarMoeda(lucroTotalFechados)}</div>
            <div className="mt-1 flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400">
                <Percent className="h-3.5 w-3.5" />
                <span>
                  {markupGeralPct === null
                    ? "Sem custo cadastrado"
                    : `Markup de ${markupGeralPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                </span>
              </div>
              <Maximize2 className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Orçamentos Feitos */}
        <Card
          onClick={() => {
            setAbaAtiva("pedidos");
            setModalAberto("orcamentos");
          }}
          className="group relative cursor-pointer overflow-hidden border-muted bg-card transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400">
              Orçamentos Pendentes
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                Detalhar
              </span>
              <div className="rounded-xl border border-blue-500/10 bg-blue-500/10 p-2 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <FileText className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarMoeda(valorOrcamentosTotais)}</div>
            <div className="mt-1 flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                <Clock className="h-3.5 w-3.5" />
                <span>{orcamentosPendentes.length} em aberto</span>
              </div>
              <Maximize2 className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Clientes & Produtos */}
        <Card
          onClick={() => {
            setAbaAtiva("produtos");
            setModalAberto("produtos");
          }}
          className="group relative cursor-pointer overflow-hidden border-muted bg-card transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/5"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
              Clientes & Produtos
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                Detalhar
              </span>
              <div className="rounded-xl border border-cyan-500/10 bg-cyan-500/10 p-2 text-cyan-500 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                <Users className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientesAtivos} Clientes</div>
            <div className="mt-1 flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                <span>{produtos.length} produtos no catálogo</span>
              </div>
              <Maximize2 className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Detalhamento Financeiro e de Produtos */}
      <Dialog
        open={modalAberto !== null}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setModalAberto(null);
            setBusca("");
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="pb-2 border-b">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pr-6">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  {modalAberto === "faturamento" && "Detalhamento de Faturamento (Pedidos Fechados)"}
                  {modalAberto === "lucro" && "Análise de Custo, Lucro e Margem"}
                  {modalAberto === "orcamentos" && "Detalhamento de Orçamentos Pendentes"}
                  {modalAberto === "produtos" && "Desempenho por Produto & Custos"}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Discriminação detalhada de valor de venda, custos por m², lucro líquido e margens.
                </DialogDescription>
              </div>

              {/* Botões de Seleção de Aba */}
              <div className="flex items-center gap-1 rounded-lg bg-muted p-1 border">
                <Button
                  type="button"
                  variant={abaAtiva === "pedidos" ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => setAbaAtiva("pedidos")}
                  className="text-xs font-medium"
                >
                  Por Registro ({modalAberto === "orcamentos" ? orcamentosPendentes.length : pedidosFechados.length})
                </Button>
                <Button
                  type="button"
                  variant={abaAtiva === "produtos" ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => setAbaAtiva("produtos")}
                  className="text-xs font-medium"
                >
                  Por Produto ({produtosConsolidados.length})
                </Button>
              </div>
            </div>

            {/* Campo de Busca */}
            <div className="mt-3 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={abaAtiva === "pedidos" ? "Buscar por cliente, código (#0001) ou produto..." : "Buscar produto..."}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
          </DialogHeader>

          {/* Conteúdo Rolável da Tabela */}
          <div className="flex-1 overflow-y-auto min-h-[300px] py-2">
            {abaAtiva === "pedidos" ? (
              /* Tabela por Registro (Pedidos / Orçamentos) */
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Produtos Vendidos</th>
                      <th className="px-4 py-3 text-right">Venda (R$)</th>
                      <th className="px-4 py-3 text-right">Custo (R$)</th>
                      <th className="px-4 py-3 text-right">Lucro (R$)</th>
                      <th className="px-4 py-3 text-right">Margem %</th>
                      <th className="px-3 py-3 w-0" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pedidosExibidosModal.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                          Nenhum registro encontrado para este filtro.
                        </td>
                      </tr>
                    ) : (
                      pedidosExibidosModal.map((p) => {
                        const isPedido = p.status === "PEDIDO";
                        return (
                          <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold">
                              <Badge
                                variant="outline"
                                className={
                                  isPedido
                                    ? "border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/40 dark:text-green-300"
                                    : "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                                }
                              >
                                {p.codigoFormatado}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 font-semibold text-foreground">{p.cadastroNome}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px]">
                              {p.itens
                                .map((i) =>
                                  i.comprimento && i.largura
                                    ? `${i.produtoNome} (${i.quantidade}x, ${i.comprimento}x${i.largura}cm)`
                                    : `${i.produtoNome} (${i.quantidade}x)`
                                )
                                .join(", ")}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-foreground">
                              {formatarMoeda(p.faturamento)}
                            </td>
                            <td className="px-4 py-3 text-right text-rose-600 dark:text-rose-400 font-medium">
                              {formatarMoeda(p.custoTotal)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              {formatarMoeda(p.lucroTotal)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Badge
                                variant="outline"
                                className={
                                  p.margemPct >= 30
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                                }
                              >
                                {p.margemPct.toFixed(1)}%
                              </Badge>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <Link
                                href={`/pedidos/${p.id}`}
                                className="inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                                title="Abrir pedido"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Tabela por Produto Consolidado */
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3">Produto</th>
                      <th className="px-4 py-3 text-right">Custo / m²</th>
                      <th className="px-4 py-3 text-right">Qtd. Vendas</th>
                      <th className="px-4 py-3 text-right">Venda Total (R$)</th>
                      <th className="px-4 py-3 text-right">Custo Total (R$)</th>
                      <th className="px-4 py-3 text-right">Lucro Total (R$)</th>
                      <th className="px-4 py-3 text-right">Margem Média</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {produtosExibidosModal.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                          Nenhum produto encontrado.
                        </td>
                      </tr>
                    ) : (
                      produtosExibidosModal.map((prod) => (
                        <tr key={prod.produtoId} className="hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-3 font-semibold text-foreground">{prod.nome}</td>
                          <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                            {formatarMoeda(prod.custoM2)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {prod.quantidadeItens} un
                            {prod.m2TotalVendida > 0 && ` (${prod.m2TotalVendida.toFixed(2)} m²)`}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-foreground">
                            {formatarMoeda(prod.faturamentoTotal)}
                          </td>
                          <td className="px-4 py-3 text-right text-rose-600 dark:text-rose-400 font-medium">
                            {formatarMoeda(prod.custoTotal)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {formatarMoeda(prod.lucroTotal)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Badge
                              variant="outline"
                              className={
                                prod.margemPct >= 30
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                              }
                            >
                              {prod.margemPct.toFixed(1)}%
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Rodapé da Modal com Totais consolidados */}
          <div className="pt-3 border-t flex flex-col sm:flex-row justify-between items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/20 px-4 py-2.5 rounded-lg border">
            <div>
              <span>Exibindo <strong>{abaAtiva === "pedidos" ? pedidosExibidosModal.length : produtosExibidosModal.length}</strong> registros</span>
            </div>
            <div className="flex gap-4 items-center">
              <span>Venda Total: <strong className="text-foreground">{formatarMoeda(abaAtiva === "pedidos" ? pedidosExibidosModal.reduce((a, b) => a + b.faturamento, 0) : produtosExibidosModal.reduce((a, b) => a + b.faturamentoTotal, 0))}</strong></span>
              <span>Custo Total: <strong className="text-rose-600 dark:text-rose-400">{formatarMoeda(abaAtiva === "pedidos" ? pedidosExibidosModal.reduce((a, b) => a + b.custoTotal, 0) : produtosExibidosModal.reduce((a, b) => a + b.custoTotal, 0))}</strong></span>
              <span>Lucro: <strong className="text-emerald-600 dark:text-emerald-400">{formatarMoeda(abaAtiva === "pedidos" ? pedidosExibidosModal.reduce((a, b) => a + b.lucroTotal, 0) : produtosExibidosModal.reduce((a, b) => a + b.lucroTotal, 0))}</strong></span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
