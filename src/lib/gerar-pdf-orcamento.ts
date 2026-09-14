import { lerImagemEmpresa } from "@/lib/imagem-empresa";
import { renderOrcamentoPdf } from "@/lib/pedido-pdf";
import { buscarCadastro } from "@/server/cadastros";
import { buscarEmpresa } from "@/server/empresa";
import { dataUriImagemProduto } from "@/server/produtos";
import type { Pedido } from "@/lib/types";

/**
 * Junta tudo que o PDF do orçamento precisa (cliente, empresa, logo/selo,
 * ícones e fotos dos produtos) e gera o arquivo. Usado tanto no download de
 * um orçamento salvo quanto na prévia antes de salvar, para os dois saírem
 * idênticos.
 */
export async function gerarPdfOrcamento(pedido: Pedido, opcoes: { previa?: boolean } = {}): Promise<Buffer> {
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
  });
}
