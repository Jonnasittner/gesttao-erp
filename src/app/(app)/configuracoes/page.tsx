import { EmpresaForm } from "@/components/configuracoes/empresa-form";
import { buscarEmpresa } from "@/server/empresa";

export default async function ConfiguracoesPage() {
  const empresa = await buscarEmpresa();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Dados da empresa usados no cabeçalho do PDF de orçamentos.
        </p>
      </div>

      <EmpresaForm empresa={empresa} />
    </div>
  );
}
