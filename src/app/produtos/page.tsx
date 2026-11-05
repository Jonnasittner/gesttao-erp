import { NovoProdutoBotao } from "@/components/produtos/novo-produto-botao";
import { ProdutosTabela } from "@/components/produtos/produtos-tabela";
import { listarProdutos } from "@/server/produtos";
import { PageHeader } from "@/components/ui/page-header";

export default async function ProdutosPage() {
  const produtos = await listarProdutos();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Produtos"
        acoes={<NovoProdutoBotao />}
      />

      <ProdutosTabela produtos={produtos} />
    </div>
  );
}
