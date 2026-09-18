import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

/** Cabeçalho padrão das telas: volta, título, descrição e ações à direita. */
export function PageHeader({
  titulo,
  descricao,
  acoes,
  voltar,
  selo,
}: {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
  voltar?: { href: string; label: string };
  selo?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        {voltar && (
          <Link
            href={voltar.href}
            className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5" /> {voltar.label}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.7rem]">{titulo}</h1>
          {selo}
        </div>
        {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  );
}
