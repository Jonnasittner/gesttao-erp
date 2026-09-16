import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { LancamentoForm } from "@/components/financeiro/lancamento-form";
import { carregarOpcoesLancamento } from "@/lib/financeiro-opcoes";
import { buscarLancamento } from "@/server/financeiro";
import { formatarCodigo } from "@/lib/codigo";

export default async function EditarLancamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lancamento, opcoes] = await Promise.all([buscarLancamento(id), carregarOpcoesLancamento()]);
  if (!lancamento) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/financeiro"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-3.5" /> Financeiro
        </Link>
        <h1 className="text-2xl font-semibold">Lançamento {formatarCodigo(lancamento.numeroDocumento)}</h1>
        {lancamento.usuarioNome && (
          <p className="text-sm text-muted-foreground">
            Lançado por {lancamento.usuarioNome} em {new Date(lancamento.createdAt).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>

      <LancamentoForm {...opcoes} lancamento={lancamento} />
    </div>
  );
}
