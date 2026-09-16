import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { LancamentoForm } from "@/components/financeiro/lancamento-form";
import { carregarOpcoesLancamento } from "@/lib/financeiro-opcoes";

export default async function NovoLancamentoPage() {
  const opcoes = await carregarOpcoesLancamento();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/financeiro"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-3.5" /> Financeiro
        </Link>
        <h1 className="text-2xl font-semibold">Novo lançamento</h1>
        <p className="text-sm text-muted-foreground">
          O número do documento é gerado automaticamente ao salvar.
        </p>
      </div>

      <LancamentoForm {...opcoes} />
    </div>
  );
}
