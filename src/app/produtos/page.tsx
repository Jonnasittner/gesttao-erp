import { NovoProdutoBotao } from "@/components/produtos/novo-produto-botao";
import { ProdutosTabela } from "@/components/produtos/produtos-tabela";
import { listarProdutos } from "@/server/produtos";

export default async function ProdutosPage() {
  const produtos = await listarProdutos();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cadastro de produtos</h1>
        <NovoProdutoBotao />
      </div>

      <ProdutosTabela produtos={produtos} />
    </div>
  );
}
