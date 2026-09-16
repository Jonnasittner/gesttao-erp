import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
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
      <div>
        <Link
          href={voltarPara ?? "/financeiro"}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-3.5" /> {voltarPara ? "Voltar ao pedido" : "Financeiro"}
        </Link>
        <h1 className="text-2xl font-semibold">Lançamento {formatarCodigo(base.numeroDocumento)}</h1>
        {base.usuarioNome && (
          <p className="text-sm text-muted-foreground">
            Lançado por {base.usuarioNome} em {new Date(base.createdAt).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>

      <LancamentoForm {...opcoes} parcelasSalvas={parcelas} voltarPara={voltarPara} />
    </div>
  );
}
