import { lerImagemEmpresa } from "@/lib/imagem-empresa";
import { renderOrcamentoPdf } from "@/lib/pedido-pdf";
import { buscarCadastro } from "@/server/cadastros";
import { buscarEmpresa } from "@/server/empresa";
import { dataUriImagemProduto } from "@/server/produtos";
import { dataUrisFotosPedido } from "@/lib/fotos-pedido";
import type { Pedido } from "@/lib/types";

/**
 * Junta tudo que o PDF do orçamento precisa (cliente, empresa, logo/selo,
 * ícones e fotos dos produtos) e gera o arquivo. Usado tanto no download de
 * um orçamento salvo quanto na prévia antes de salvar, para os dois saírem
 * idênticos.
 */
export async function gerarPdfOrcamento(
  pedido: Pedido,
  opcoes: {
    previa?: boolean;
    /** De qual pedido salvo buscar as fotos (na prévia de edição o id é "previa"). */
    fotosDoPedidoId?: string;
    /** Fotos já prontas (prévia de orçamento novo); têm prioridade sobre as salvas. */
    fotos?: string[];
  } = {}
): Promise<Buffer> {
  const idFotos = opcoes.fotos ? undefined : opcoes.fotosDoPedidoId ?? (opcoes.previa ? undefined : pedido.id);
  const produtoIds = [...new Set(pedido.itens.map((item) => item.produtoId).filter(Boolean))];

  const [
    cliente,
    empresa,
    logoDataUri,
    seloDataUri,
    whatsappDataUri,
    instagramDataUri,
    siteDataUri,
    emailDataUri,
    imagensProdutosLista,
    fotos,
  ] = await Promise.all([
    buscarCadastro(pedido.cadastroId),
    buscarEmpresa(),
    lerImagemEmpresa("logo"),
    lerImagemEmpresa("selo"),
    lerImagemEmpresa("whatsapp"),
    lerImagemEmpresa("instagram"),
    lerImagemEmpresa("site"),
    lerImagemEmpresa("email"),
    Promise.all(produtoIds.map((produtoId) => dataUriImagemProduto(produtoId))),
    idFotos ? dataUrisFotosPedido(idFotos) : Promise.resolve(opcoes.fotos ?? []),
  ]);

  const imagensProdutos = Object.fromEntries(
    produtoIds.map((produtoId, index) => [produtoId, imagensProdutosLista[index]])
  );

  return renderOrcamentoPdf({
    pedido,
    cliente,
    empresa,
    logoDataUri,
    seloDataUri,
    whatsappDataUri,
    instagramDataUri,
    siteDataUri,
    emailDataUri,
    imagensProdutos,
    previa: opcoes.previa,
    fotos,
  });
}
