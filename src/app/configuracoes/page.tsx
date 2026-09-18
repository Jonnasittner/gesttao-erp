import { EmpresaForm } from "@/components/configuracoes/empresa-form";
import { UsuariosSecao } from "@/components/configuracoes/usuarios-secao";
import { auth } from "@/lib/auth";
import { buscarEmpresa } from "@/server/empresa";
import { listarUsuarios } from "@/server/usuarios";
import { PageHeader } from "@/components/ui/page-header";

export default async function ConfiguracoesPage() {
  const [session, empresa, usuarios] = await Promise.all([
    auth(),
    buscarEmpresa(),
    listarUsuarios(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <PageHeader
          titulo="Configurações"
          descricao="Dados da empresa usados no cabeçalho do PDF e quem pode entrar no sistema."
        />

        <div className="superficie p-5">
          <h2 className="mb-4 text-base font-semibold">Empresa</h2>
          <EmpresaForm empresa={empresa} />
        </div>
      </div>

      <div className="superficie p-5">
        <UsuariosSecao usuarios={usuarios} usuarioAtualId={session?.user?.id ?? ""} />
      </div>
    </div>
  );
}
