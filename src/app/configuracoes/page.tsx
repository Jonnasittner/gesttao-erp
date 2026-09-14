import { EmpresaForm } from "@/components/configuracoes/empresa-form";
import { UsuariosSecao } from "@/components/configuracoes/usuarios-secao";
import { auth } from "@/lib/auth";
import { buscarEmpresa } from "@/server/empresa";
import { listarUsuarios } from "@/server/usuarios";

export default async function ConfiguracoesPage() {
  const [session, empresa, usuarios] = await Promise.all([
    auth(),
    buscarEmpresa(),
    listarUsuarios(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Dados da empresa usados no cabeçalho do PDF de orçamentos.
          </p>
        </div>

        <EmpresaForm empresa={empresa} />
      </div>

      <div className="border-t pt-6">
        <UsuariosSecao usuarios={usuarios} usuarioAtualId={session?.user?.id ?? ""} />
      </div>
    </div>
  );
}
