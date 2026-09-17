import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { gerarPdfOrcamento } from "@/lib/gerar-pdf-orcamento";
import { pedidoSchema, type Pedido } from "@/lib/types";

// Gera o PDF com os dados que ainda estão no formulário, sem gravar nada.
// Corpo: { dados: PedidoInput, numero?: number, createdAt?: string, pedidoId?: string } —
// numero/createdAt/pedidoId vêm só na edição de um orçamento já salvo.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Não autenticado", { status: 401 });
  }

  const corpo = await req.json().catch(() => null);
  const parsed = pedidoSchema.safeParse(corpo?.dados);
  if (!parsed.success) {
    return new NextResponse(parsed.error.issues[0]?.message ?? "Dados inválidos", { status: 400 });
  }

  const dados = parsed.data;
  const pedido: Pedido = {
    ...dados,
    id: "previa",
    custoSugerido: null,
    fotos: [],
    numero: typeof corpo.numero === "number" ? corpo.numero : 0,
    total: dados.itens.reduce((soma, item) => soma + item.quantidade * item.precoUnitario, 0),
    createdAt: typeof corpo.createdAt === "string" && corpo.createdAt ? corpo.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Na edição, a prévia mostra as fotos já anexadas ao orçamento salvo.
  const fotosDoPedidoId = typeof corpo.pedidoId === "string" && corpo.pedidoId ? corpo.pedidoId : undefined;
  const pdfBuffer = await gerarPdfOrcamento(pedido, { previa: true, fotosDoPedidoId });

  return new NextResponse(new Blob([Uint8Array.from(pdfBuffer)]), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="previa-orcamento.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
