import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listarCadastros } from "@/server/cadastros";
import { listarRamosAtividade } from "@/server/ramos-atividade";
import { formatarCodigo } from "@/lib/contador";
import { TIPO_CADASTRO, type TipoCadastro } from "@/lib/types";
import { CORES_TIPO_CADASTRO, CORES_TIPO_CADASTRO_ATIVO } from "@/lib/rotulos";

const ROTULOS_TIPO_CADASTRO: Record<TipoCadastro, string> = {
  CLIENTE: "Cliente",
  FORNECEDOR: "Fornecedor",
  INTERNO: "Interno",
};

const FILTROS = [
  { valor: undefined, label: "Todos" },
  ...TIPO_CADASTRO.map((tipo) => ({ valor: tipo, label: ROTULOS_TIPO_CADASTRO[tipo] })),
] as const;

export default async function CadastrosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo } = await searchParams;
  const tipoFiltro = TIPO_CADASTRO.includes(tipo as TipoCadastro) ? (tipo as TipoCadastro) : undefined;
  const [cadastros, ramosAtividade] = await Promise.all([
    listarCadastros(tipoFiltro),
    listarRamosAtividade(),
  ]);
  const nomeRamoPorId = new Map(ramosAtividade.map((r) => [r.id, r.nome]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cadastros</h1>
        <Button nativeButton={false} render={<Link href="/cadastros/novo">Novo cadastro</Link>} />
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTROS.map((filtro) => {
          const ativo = tipoFiltro === filtro.valor;
          const classe = filtro.valor
            ? ativo
              ? CORES_TIPO_CADASTRO_ATIVO[filtro.valor]
              : CORES_TIPO_CADASTRO[filtro.valor]
            : ativo
              ? "border-primary bg-primary text-primary-foreground"
              : "border-transparent text-muted-foreground hover:bg-accent";

          return (
            <Link
              key={filtro.label}
              href={filtro.valor ? `/cadastros?tipo=${filtro.valor}` : "/cadastros"}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${classe}`}
            >
              {filtro.label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Ramo de atividade</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cadastros.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhum cadastro encontrado.
                </TableCell>
              </TableRow>
            )}
            {cadastros.map((cadastro) => (
              <TableRow key={cadastro.id}>
                <TableCell className="font-mono">{formatarCodigo(cadastro.codigo)}</TableCell>
                <TableCell>
                  <Link href={`/cadastros/${cadastro.id}`} className="font-medium hover:underline">
                    {cadastro.nome}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {cadastro.tipos.map((tipo) => (
                      <Badge key={tipo} variant="outline" className={CORES_TIPO_CADASTRO[tipo]}>
                        {ROTULOS_TIPO_CADASTRO[tipo]}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {cadastro.ramoAtividadeId ? nomeRamoPorId.get(cadastro.ramoAtividadeId) ?? "—" : "—"}
                </TableCell>
                <TableCell>{cadastro.telefone || "—"}</TableCell>
                <TableCell>{cadastro.email || "—"}</TableCell>
                <TableCell>
                  <Badge variant={cadastro.status === "ATIVO" ? "default" : "secondary"}>
                    {cadastro.status === "ATIVO" ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
