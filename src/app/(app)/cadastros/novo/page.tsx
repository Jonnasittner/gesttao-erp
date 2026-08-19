import { CadastroForm } from "@/components/cadastros/cadastro-form";
import { listarRamosAtividade } from "@/server/ramos-atividade";
import { listarSugestoesEndereco } from "@/server/enderecos";

export default async function NovoCadastroPage() {
  const [ramosAtividade, sugestoesEndereco] = await Promise.all([
    listarRamosAtividade(),
    listarSugestoesEndereco(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Novo cadastro</h1>
      <CadastroForm ramosAtividade={ramosAtividade} sugestoesEndereco={sugestoesEndereco} />
    </div>
  );
}
