import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { LancamentoForm, type VinculoPedido } from "@/components/financeiro/lancamento-form";
import { carregarOpcoesLancamento } from "@/lib/financeiro-opcoes";
import { buscarPedido } from "@/server/pedidos";
import { formatarCodigo } from "@/lib/codigo";
import { CATEGORIA_CUSTO, TIPO_LANCAMENTO, type CategoriaCusto, type TipoLancamento } from "@/lib/types";

// Modos:
// - ?converterPedido=<id>        "Transformar em Pedido": condição de pagamento + conversão.
// - ?pedido=<id>&tipo=PAGAR      "Adicionar custo" a um pedido (opcional &categoria=FRETE).
// - ?pedido=<id>&tipo=RECEBER    "Lançar recebimento" de um pedido.
// - sem parâmetros               lançamento avulso.
export default async function NovoLancamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ converterPedido?: string; pedido?: string; tipo?: string; categoria?: string }>;
}) {
  const params = await searchParams;
  const pedidoId = params.converterPedido || params.pedido;
  const converter = !!params.converterPedido;

  const [opcoes, pedido] = await Promise.all([
    carregarOpcoesLancamento(),
    pedidoId ? buscarPedido(pedidoId) : null,
  ]);

  if (pedidoId && (!pedido || (converter && pedido.status === "PEDIDO"))) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{converter ? "Gerar pedido" : "Novo lançamento"}</h1>
        <p className="text-sm text-muted-foreground">
          {pedido
            ? `O orçamento ${formatarCodigo(pedido.numero)} já foi transformado em pedido.`
            : "Pedido não encontrado."}
        </p>
        <Link href={pedido ? `/pedidos/${pedido.id}` : "/pedidos"} className="text-sm text-primary hover:underline">
          Voltar
        </Link>
      </div>
    );
  }

  const tipo: TipoLancamento = converter
    ? "RECEBER"
    : TIPO_LANCAMENTO.includes(params.tipo as TipoLancamento)
      ? (params.tipo as TipoLancamento)
      : "RECEBER";
  const categoria = CATEGORIA_CUSTO.includes(params.categoria as CategoriaCusto)
    ? (params.categoria as CategoriaCusto)
    : undefined;

  const vinculo: VinculoPedido | undefined = pedido
    ? {
        pedidoId: pedido.id,
        numero: pedido.numero,
        total: pedido.total,
        clienteId: pedido.cadastroId,
        clienteNome: pedido.cadastroNome,
        tipo,
        converter,
        categoria,
      }
    : undefined;

  const codigo = pedido ? formatarCodigo(pedido.numero) : "";
  const titulo = !pedido
    ? "Novo lançamento"
    : converter
      ? `Gerar pedido ${codigo}`
      : tipo === "PAGAR"
        ? `Custo do pedido ${codigo}`
        : `Recebimento do pedido ${codigo}`;
  const descricao = !pedido
    ? "O número do documento é gerado automaticamente ao salvar."
    : converter
      ? "Informe a condição de pagamento. Ao salvar, o orçamento vira pedido e o lançamento a receber é criado."
      : tipo === "PAGAR"
        ? "Custos com fornecedor, frete e outros entram na margem do pedido."
        : "Recebimento do cliente vinculado a este pedido.";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href={pedido ? `/pedidos/${pedido.id}` : "/financeiro"}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-3.5" />{" "}
          {pedido ? `${pedido.status === "PEDIDO" ? "Pedido" : "Orçamento"} ${codigo}` : "Financeiro"}
        </Link>
        <h1 className="text-2xl font-semibold">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{descricao}</p>
      </div>

      <LancamentoForm {...opcoes} vinculo={vinculo} />
    </div>
  );
}
