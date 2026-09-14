import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buscarPedido } from "@/server/pedidos";
import { gerarPdfOrcamento } from "@/lib/gerar-pdf-orcamento";
import { formatarCodigo } from "@/lib/codigo";

// ?visualizar=1 abre o PDF dentro da página (prévia antes de baixar);
// sem o parâmetro, o navegador baixa o arquivo.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Não autenticado", { status: 401 });
  }

  const { id } = await params;
  const pedido = await buscarPedido(id);
  if (!pedido) {
    return new NextResponse("Orçamento não encontrado", { status: 404 });
  }

  const pdfBuffer = await gerarPdfOrcamento(pedido);
  const prefixo = pedido.status === "PEDIDO" ? "pedido" : "orcamento";
  const disposicao = new URL(req.url).searchParams.has("visualizar") ? "inline" : "attachment";

  return new NextResponse(new Blob([Uint8Array.from(pdfBuffer)]), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposicao}; filename="${prefixo}-${formatarCodigo(pedido.numero)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
