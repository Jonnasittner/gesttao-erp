import Link from "next/link";
import { BaixarPdfIcone } from "@/components/pedidos/baixar-pdf-icone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NovoPedidoDialog } from "@/components/pedidos/novo-pedido-dialog";
import { EditarPedidoDialog } from "@/components/pedidos/editar-pedido-dialog";
import { ExcluirPedidoBotao } from "@/components/pedidos/excluir-pedido-botao";
import { ConverterPedidoBotao } from "@/components/pedidos/converter-pedido-botao";
import { PedidoClicavel } from "@/components/pedidos/pedido-clicavel";
import { PageHeader } from "@/components/ui/page-header";
import { listarPedidos } from "@/server/pedidos";
import { listarProdutos } from "@/server/produtos";
import { listarCadastros } from "@/server/cadastros";
import { buscarEmpresa } from "@/server/empresa";
import { listarLancamentos } from "@/server/financeiro";
import { calcularMargemPedido } from "@/lib/financeiro";
import { montarSugestoesEndereco } from "@/lib/sugestoes-endereco";
import type { Lancamento, Pedido } from "@/lib/types";
import { formatarCodigo } from "@/lib/codigo";
import { formatarMoeda } from "@/lib/moeda";

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<Partial<Record<CampoBusca, string>>>;
}) {
  const busca = lerBusca(await searchParams);
  const [pedidos, clientes, produtos, empresa, lancamentos] = await Promise.all([
    listarPedidos(),
    listarCadastros("CLIENTE"),
    listarProdutos(),
    buscarEmpresa(),
    listarLancamentos(),
  ]);

  // Lançamentos agrupados por pedido, para a margem mostrada no pop-up.
  const lancamentosPorPedido = new Map<string, Lancamento[]>();
  for (const l of lancamentos) {
    if (!l.pedidoId) continue;
    lancamentosPorPedido.set(l.pedidoId, [...(lancamentosPorPedido.get(l.pedidoId) ?? []), l]);
  }

  const opcoesClientes = clientes.map((c) => ({ value: c.id, label: c.nome }));

  // A cidade vem do cadastro do cliente, que a página já lê para o formulário
  // de novo pedido: nenhuma leitura a mais no Firestore.
  const cidadePorCliente = new Map(
    clientes.map((c) => [c.id, [c.cidade, c.estado].filter(Boolean).join("/")]),
  );

  // Sugestões (cidade, bairro, rua…) do cadastro rápido de cliente no orçamento,
  // montadas com os mesmos clientes: também sem leitura a mais.
  const sugestoesEndereco = montarSugestoesEndereco(clientes);

  /** Dados de cada pedido usados tanto na tabela quanto nos cartões. */
  const linhas = pedidos.map((pedido) => {
    const isPedido = pedido.status === "PEDIDO";
    return {
      pedido,
      isPedido,
      codigo: formatarCodigo(pedido.numero),
      cidade: cidadePorCliente.get(pedido.cadastroId) ?? "",
      dataHora: formatarDataHoraBrasilia(pedido.createdAt),
      // Orçamento não tem margem.
      margem: isPedido ? (
        <CelulaMargem isPedido total={pedido.total} lancamentos={lancamentosPorPedido.get(pedido.id) ?? []} />
      ) : undefined,
      acoes: (
        <AcoesPedido
          pedido={pedido}
          codigo={formatarCodigo(pedido.numero)}
          clientes={opcoesClientes}
          produtos={produtos}
        />
      ),
    };
  });

  // Filtros aplicados em memória sobre o que já foi lido: nenhuma leitura a mais.
  const filtradas = linhas.filter((l) => atendeBusca(l.pedido, l.cidade, busca));
  const temBusca = CAMPOS_BUSCA.some((c) => busca[c]);
  // Sugestões do campo cidade: só as cidades que aparecem nos pedidos.
  const cidades = [...new Set(linhas.map((l) => l.cidade).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const vazio = linhas.length === 0 ? "Nenhum pedido ou orçamento ainda." : "Nenhum pedido ou orçamento com esses filtros.";

  /** Link que troca só a situação e mantém os outros filtros. */
  function linkSituacao(situacao: string) {
    const query = new URLSearchParams();
    for (const campo of CAMPOS_BUSCA) if (campo !== "situacao" && busca[campo]) query.set(campo, busca[campo]);
    if (situacao) query.set("situacao", situacao);
    const texto = query.toString();
    return texto ? `/pedidos?${texto}` : "/pedidos";
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader titulo="Pedidos e orçamentos" />
      {/* Topo enxuto: situação à esquerda, contagem e "Novo orçamento" à direita */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1">
          {FILTROS_SITUACAO.map((f) => (
            <Link
              key={f.valor}
              href={linkSituacao(f.valor)}
              className={`rounded-lg px-3 py-1 text-sm font-medium transition-all ${
                busca.situacao === f.valor
                  ? "bg-card text-foreground sombra-suave ring-1 ring-border"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {temBusca ? `${filtradas.length} de ${linhas.length}` : linhas.length}{" "}
          {linhas.length === 1 && !temBusca ? "registro" : "registros"}
        </span>
        <NovoPedidoDialog
          clientes={opcoesClientes}
          produtosIniciais={produtos}
          observacaoPadrao={empresa?.observacaoPadraoPedido}
          sugestoesEndereco={sugestoesEndereco}
        />
      </div>

      {/* Busca por data, número, cliente, cidade e valor — formulário GET, mantém a situação */}
      <form action="/pedidos" className="superficie grid grid-cols-2 items-end gap-2 p-2 sm:grid-cols-4 lg:grid-cols-9">
        {busca.situacao && <input type="hidden" name="situacao" value={busca.situacao} />}
        <CampoFiltro rotulo="Data de">
          <Input type="date" name="de" defaultValue={busca.de} />
        </CampoFiltro>
        <CampoFiltro rotulo="até">
          <Input type="date" name="ate" defaultValue={busca.ate} />
        </CampoFiltro>
        <CampoFiltro rotulo="Número">
          <Input name="numero" inputMode="numeric" defaultValue={busca.numero} placeholder="Ex.: 12" />
        </CampoFiltro>
        <CampoFiltro rotulo="Cliente" className="sm:col-span-1 lg:col-span-2">
          <Input name="cliente" defaultValue={busca.cliente} placeholder="Nome do cliente" />
        </CampoFiltro>
        <CampoFiltro rotulo="Cidade">
          <Input name="cidade" list="cidades-pedidos" defaultValue={busca.cidade} placeholder="Cidade" />
          <datalist id="cidades-pedidos">
            {cidades.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </CampoFiltro>
        <CampoFiltro rotulo="Valor de (R$)">
          <Input type="number" name="valorMin" min="0" step="0.01" inputMode="decimal" defaultValue={busca.valorMin} />
        </CampoFiltro>
        <CampoFiltro rotulo="até (R$)">
          <Input type="number" name="valorMax" min="0" step="0.01" inputMode="decimal" defaultValue={busca.valorMax} />
        </CampoFiltro>
        {/* No PC os botões ficam na mesma linha dos campos. */}
        <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-4 lg:col-span-1">
          {temBusca && (
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/pedidos">Limpar</Link>} />
          )}
          <Button type="submit" size="sm">
            Filtrar
          </Button>
        </div>
      </form>

      {/* Lista — celular: cartões. Tocar no cartão mostra os itens. */}
      <div className="flex flex-col gap-2 sm:hidden">
        {filtradas.length === 0 && (
          <p className="superficie py-10 text-center text-sm text-muted-foreground">
            {vazio}
          </p>
        )}
        {filtradas.map(({ pedido, isPedido, codigo, cidade, dataHora, margem, acoes }) => (
          <PedidoClicavel
            key={pedido.id}
            como="cartao"
            pedido={pedido}
            cidade={cidade}
            dataHora={dataHora}
            margem={margem}
            className={`superficie flex flex-col gap-2 border-l-4 p-3 ${isPedido ? "border-l-green-500" : "border-l-blue-500"} ${corDoTexto(isPedido)} ${corDoFundoCartao(isPedido)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono font-medium">{codigo}</span>
                  <span className="tabular-nums">{dataHora}</span>
                </p>
                <p className="mt-1 font-medium leading-tight">
                  <Link href={`/pedidos/${pedido.id}`} className="hover:underline">
                    {pedido.cadastroNome}
                  </Link>
                </p>
                {cidade && <p className="text-xs text-muted-foreground">{cidade}</p>}
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{formatarMoeda(pedido.total)}</span>
            </div>
            <div className="border-t pt-2">{acoes}</div>
          </PedidoClicavel>
        ))}
      </div>

      {/* Lista — PC: tabela. Clicar na linha mostra os itens. */}
      <div className="superficie hidden overflow-x-auto sm:block">
        {/* Divisórias mais visíveis entre linhas e colunas (a última coluna, das ações, não tem borda à direita). */}
        <Table className="[&_td]:py-1 [&_th]:h-8 [&_td]:border-r [&_td]:border-foreground/50 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-foreground/50 [&_th:last-child]:border-r-0 [&_tr]:border-b [&_tr]:border-foreground/50">

          <TableHeader>
            <TableRow>
              <TableHead>Data e hora</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {vazio}
                </TableCell>
              </TableRow>
            )}
            {filtradas.map(({ pedido, isPedido, codigo, cidade, dataHora, margem, acoes }) => (
              <PedidoClicavel
                key={pedido.id}
                como="linha"
                pedido={pedido}
                cidade={cidade}
                dataHora={dataHora}
                margem={margem}
                className={`${corDoTexto(isPedido)} ${corDoFundo(isPedido)}`}
              >
                <TableCell className="whitespace-nowrap tabular-nums">{dataHora}</TableCell>
                <TableCell>
                  <span className="font-mono font-medium">{codigo}</span>
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/pedidos/${pedido.id}`} className="hover:underline">
                    {pedido.cadastroNome}
                  </Link>
                </TableCell>
                <TableCell>{cidade || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-right tabular-nums">{formatarMoeda(pedido.total)}</TableCell>
                <TableCell>{acoes}</TableCell>
              </PedidoClicavel>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Texto da linha/cartão: verde quando já virou pedido, azul enquanto é orçamento. */
function corDoTexto(isPedido: boolean) {
  return isPedido ? "text-green-700 dark:text-green-400" : "text-blue-700 dark:text-blue-400";
}

/** Fundo da linha: verde clarinho para pedido, azul clarinho para orçamento (um pouco mais forte ao passar o mouse). */
function corDoFundo(isPedido: boolean) {
  return isPedido
    ? "bg-green-50 hover:bg-green-100 dark:bg-green-950/40 dark:hover:bg-green-950/70"
    : "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/70";
}

/** Mesmo fundo no cartão do celular; o "!" vence o fundo padrão da classe .superficie. */
function corDoFundoCartao(isPedido: boolean) {
  return isPedido ? "bg-green-50! dark:bg-green-950/40!" : "bg-blue-50! dark:bg-blue-950/40!";
}

/** Editar, converter em pedido (só orçamento) e excluir. */
function AcoesPedido({
  pedido,
  codigo,
  clientes,
  produtos,
}: {
  pedido: Pedido;
  codigo: string;
  clientes: { value: string; label: string }[];
  produtos: Awaited<ReturnType<typeof listarProdutos>>;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <EditarPedidoDialog pedido={pedido} clientes={clientes} produtosIniciais={produtos} />
      {/* Baixa direto o mesmo PDF da tela do pedido, sem abrir a prévia. */}
      <BaixarPdfIcone
        pedidoId={pedido.id}
        nomeArquivo={`${pedido.status === "PEDIDO" ? "pedido" : "orcamento"}-${codigo}.pdf`}
      />
      {pedido.status !== "PEDIDO" && (
        <ConverterPedidoBotao id={pedido.id} numero={codigo} size="sm" showText={false} />
      )}
      <ExcluirPedidoBotao id={pedido.id} numero={codigo} />
    </div>
  );
}

/** "05/11/2026, 14:05" no horário de Brasília (o servidor roda em UTC). */
function formatarDataHoraBrasilia(iso: string): string {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Margem do pedido no pop-up; sem custo lançado não mostra % (seria 100% enganoso). */
function CelulaMargem({ isPedido, total, lancamentos }: { isPedido: boolean; total: number; lancamentos: Lancamento[] }) {
  if (!isPedido) return <span className="text-muted-foreground">—</span>;
  const margem = calcularMargemPedido(total, lancamentos);
  if (margem.custos === 0) return <span className="text-xs text-muted-foreground">sem custos</span>;
  return (
    <span className={margem.margem < 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}>
      {formatarMoeda(margem.margem)}
      {margem.margemPercentual !== null && (
        <span className="ml-1 text-xs text-muted-foreground">
          ({margem.margemPercentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Filtros: situação, data, número, cliente, cidade e valor
// ---------------------------------------------------------------------------

const FILTROS_SITUACAO = [
  { valor: "", label: "Todos" },
  { valor: "pedidos", label: "Pedidos feitos" },
  { valor: "orcamentos", label: "Orçamentos" },
] as const;

const CAMPOS_BUSCA = ["situacao", "de", "ate", "numero", "cliente", "cidade", "valorMin", "valorMax"] as const;
type CampoBusca = (typeof CAMPOS_BUSCA)[number];
type Busca = Record<CampoBusca, string>;

function lerBusca(params: Partial<Record<CampoBusca, string>>): Busca {
  const data = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
  const valor = (v?: string) => (v && Number.isFinite(Number(v)) ? v : "");
  return {
    situacao: FILTROS_SITUACAO.some((f) => f.valor === params.situacao) ? (params.situacao ?? "") : "",
    de: data(params.de),
    ate: data(params.ate),
    numero: params.numero?.replace(/\D/g, "") ?? "",
    cliente: params.cliente?.trim() ?? "",
    cidade: params.cidade?.trim() ?? "",
    valorMin: valor(params.valorMin),
    valorMax: valor(params.valorMax),
  };
}

/** Minúsculas e sem acento, para "joao" achar "João". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** "AAAA-MM-DD" do dia em que o pedido foi criado, no horário de Brasília. */
function diaBrasilia(iso: string): string {
  const data = new Date(iso);
  if (!iso || Number.isNaN(data.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(data);
}

function atendeBusca(pedido: Pedido, cidade: string, b: Busca): boolean {
  if (b.situacao === "pedidos" && pedido.status !== "PEDIDO") return false;
  if (b.situacao === "orcamentos" && pedido.status === "PEDIDO") return false;
  if (b.de || b.ate) {
    const dia = diaBrasilia(pedido.createdAt);
    if (b.de && (!dia || dia < b.de)) return false;
    if (b.ate && (!dia || dia > b.ate)) return false;
  }
  // "12", "0012" ou "Nº 12" acham o pedido 12.
  if (b.numero && pedido.numero !== Number(b.numero)) return false;
  if (b.cliente && !normalizar(pedido.cadastroNome).includes(normalizar(b.cliente))) return false;
  if (b.cidade && !normalizar(cidade).includes(normalizar(b.cidade))) return false;
  if (b.valorMin && pedido.total < Number(b.valorMin)) return false;
  if (b.valorMax && pedido.total > Number(b.valorMax)) return false;
  return true;
}

function CampoFiltro({
  rotulo,
  className = "",
  children,
}: {
  rotulo: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs font-medium text-muted-foreground ${className}`}>
      {rotulo}
      {children}
    </label>
  );
}
