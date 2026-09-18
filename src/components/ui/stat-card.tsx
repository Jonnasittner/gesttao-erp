import Link from "next/link";

/** Cartão de indicador (valor em destaque + detalhe), usado nos resumos. */
export function StatCard({
  titulo,
  valor,
  detalhe,
  icone,
  classeValor = "text-foreground",
  href,
  destaque = false,
}: {
  titulo: string;
  valor: React.ReactNode;
  detalhe?: React.ReactNode;
  icone?: React.ReactNode;
  classeValor?: string;
  href?: string;
  destaque?: boolean;
}) {
  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{titulo}</span>
        {icone && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {icone}
          </span>
        )}
      </div>
      <span className={`text-xl font-semibold tabular-nums sm:text-2xl ${classeValor}`}>{valor}</span>
      {detalhe && <span className="text-xs text-muted-foreground">{detalhe}</span>}
    </>
  );

  const classe = `superficie flex flex-col gap-1 p-4 ${destaque ? "ring-1 ring-primary/20" : ""}`;

  if (href) {
    return (
      <Link href={href} className={`${classe} superficie-interativa`}>
        {conteudo}
      </Link>
    );
  }
  return <div className={classe}>{conteudo}</div>;
}
