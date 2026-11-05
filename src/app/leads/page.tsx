import { PageHeader } from "@/components/ui/page-header";
import { BuscaLeads } from "@/components/leads/busca-leads";
import { listarCidadesCadastradas, listarNomesCadastrados } from "@/server/leads";
import { listarProdutos } from "@/server/produtos";
import { buscarEmpresa } from "@/server/empresa";

export default async function LeadsPage() {
  const [cidadesSugeridas, nomesCadastrados, produtos, empresa] = await Promise.all([
    listarCidadesCadastradas(),
    listarNomesCadastrados(),
    listarProdutos(),
    buscarEmpresa(),
  ]);

  // Só os produtos com foto entram na apresentação comercial.
  const produtosComFoto = produtos
    .filter((produto) => produto.imagemUrl)
    .map((produto) => ({ id: produto.id, nome: produto.nome, imagemUrl: produto.imagemUrl }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Geração de Leads"
      />

      <BuscaLeads
        cidadesSugeridas={cidadesSugeridas}
        nomesCadastrados={nomesCadastrados}
        produtosComFoto={produtosComFoto}
        empresa={{
          nome: empresa?.nome ?? "",
          telefone: empresa?.telefone ?? "",
          site: empresa?.site ?? "",
        }}
      />
    </div>
  );
}
