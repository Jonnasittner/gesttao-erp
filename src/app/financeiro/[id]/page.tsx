import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { LancamentoForm } from "@/components/financeiro/lancamento-form";
import { carregarOpcoesLancamento } from "@/lib/financeiro-opcoes";
import { buscarDocumentoFinanceiro } from "@/server/financeiro";
import { formatarCodigo } from "@/lib/codigo";

export default async function EditarLancamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [parcelas, opcoes] = await Promise.all([buscarDocumentoFinanceiro(id), carregarOpcoesLancamento()]);
  if (!parcelas?.length) notFound();
  const base = parcelas[0];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/financeiro"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-3.5" /> Financeiro
        </Link>
        <h1 className="text-2xl font-semibold">Lançamento {formatarCodigo(base.numeroDocumento)}</h1>
        {base.usuarioNome && (
          <p className="text-sm text-muted-foreground">
            Lançado por {base.usuarioNome} em {new Date(base.createdAt).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>

      <LancamentoForm {...opcoes} parcelasSalvas={parcelas} />
    </div>
  );
}
