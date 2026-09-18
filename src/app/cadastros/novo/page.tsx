import { CadastroForm } from "@/components/cadastros/cadastro-form";
import { PageHeader } from "@/components/ui/page-header";
import { listarSugestoesEndereco } from "@/server/enderecos";

export default async function NovoCadastroPage() {
  const sugestoesEndereco = await listarSugestoesEndereco();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Novo cadastro"
        descricao="Cliente, fornecedor ou contato interno."
        voltar={{ href: "/cadastros", label: "Cadastros" }}
      />
      <CadastroForm sugestoesEndereco={sugestoesEndereco} />
    </div>
  );
}
