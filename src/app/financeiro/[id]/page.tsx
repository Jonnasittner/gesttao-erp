import { notFound } from "next/navigation";
import { ReceiptIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { LancamentoForm } from "@/components/financeiro/lancamento-form";
import { carregarOpcoesLancamento } from "@/lib/financeiro-opcoes";
import { buscarDocumentoFinanceiro } from "@/server/financeiro";
import { formatarCodigo } from "@/lib/codigo";

export default async function EditarLancamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voltar?: string }>;
}) {
  const [{ id }, { voltar }] = await Promise.all([params, searchParams]);
  const [parcelas, opcoes] = await Promise.all([buscarDocumentoFinanceiro(id), carregarOpcoesLancamento()]);
  if (!parcelas?.length) notFound();
  const base = parcelas[0];

  // Só aceita voltar para a tela de um pedido (evita redirecionar para qualquer lugar).
  const voltarPara = voltar && /^\/pedidos\/[A-Za-z0-9]+$/.test(voltar) ? voltar : undefined;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        titulo={`Lançamento ${formatarCodigo(base.numeroDocumento)}`}
        voltar={{ href: voltarPara ?? "/financeiro", label: voltarPara ? "Voltar ao pedido" : "Financeiro" }}
        descricao={
          base.usuarioNome
            ? `Lançado por ${base.usuarioNome} em ${new Date(base.createdAt).toLocaleDateString("pt-BR")}`
            : undefined
        }
        acoes={
          base.comprovanteUrl ? (
            <a
              href={base.comprovanteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              <ReceiptIcon className="size-4" /> Ver cupom
            </a>
          ) : undefined
        }
      />

      <LancamentoForm {...opcoes} parcelasSalvas={parcelas} voltarPara={voltarPara} />
    </div>
  );
}
