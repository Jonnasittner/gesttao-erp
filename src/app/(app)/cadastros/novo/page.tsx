import { CadastroForm } from "@/components/cadastros/cadastro-form";
import { listarSugestoesEndereco } from "@/server/enderecos";

export default async function NovoCadastroPage() {
  const sugestoesEndereco = await listarSugestoesEndereco();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Novo cadastro</h1>
      <CadastroForm sugestoesEndereco={sugestoesEndereco} />
    </div>
  );
}
