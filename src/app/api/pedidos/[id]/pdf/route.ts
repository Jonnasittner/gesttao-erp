import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { lerImagemEmpresa } from "@/lib/imagem-empresa";
import { buscarPedido } from "@/server/pedidos";
import { buscarCadastro } from "@/server/cadastros";
import { buscarEmpresa } from "@/server/empresa";
import { dataUriImagemProduto } from "@/server/produtos";
import { renderOrcamentoPdf } from "@/lib/pedido-pdf";
import { formatarCodigo } from "@/lib/codigo";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Não autenticado", { status: 401 });
  }

  const { id } = await params;
  const pedido = await buscarPedido(id);
  if (!pedido) {
    return new NextResponse("Orçamento não encontrado", { status: 404 });
  }

  const produtoIds = [...new Set(pedido.itens.map((item) => item.produtoId).filter(Boolean))];

  const [cliente, empresa, logoDataUri, seloDataUri, imagensProdutosLista] = await Promise.all([
    buscarCadastro(pedido.cadastroId),
    buscarEmpresa(),
    lerImagemEmpresa("logo"),
    lerImagemEmpresa("selo"),
    Promise.all(produtoIds.map((produtoId) => dataUriImagemProduto(produtoId))),
  ]);

  const imagensProdutos = Object.fromEntries(
    produtoIds.map((produtoId, index) => [produtoId, imagensProdutosLista[index]])
  );

  const pdfBuffer = await renderOrcamentoPdf({
    pedido,
    cliente,
    empresa,
    logoDataUri,
    seloDataUri,
    imagensProdutos,
  });

  return new NextResponse(new Blob([Uint8Array.from(pdfBuffer)]), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="orcamento-${formatarCodigo(pedido.numero)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
