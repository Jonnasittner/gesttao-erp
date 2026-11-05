import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { lerAnexo } from "@/lib/anexos-storage";
import { movimentacoesRef } from "@/lib/conciliacao";

/** Cupom (foto ou PDF) anexado ao justificar uma movimentação do Asaas. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Não autenticado", { status: 401 });
  }

  const { id } = await params;
  const doc = await movimentacoesRef().doc(id).get();
  const comprovante = doc.data()?.comprovante as { chave: string; tipo: string; nome: string } | null | undefined;
  if (!comprovante?.chave) {
    return new NextResponse("Cupom não encontrado", { status: 404 });
  }

  const conteudo = await lerAnexo(comprovante.chave);
  if (!conteudo) {
    return new NextResponse("Arquivo não encontrado no storage", { status: 404 });
  }

  return new NextResponse(new Blob([Uint8Array.from(conteudo)]), {
    headers: {
      "Content-Type": comprovante.tipo || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(comprovante.nome || "cupom")}"`,
      // A chave muda a cada envio, mas a URL é a da movimentação: sem cache longo.
      "Cache-Control": "private, no-cache",
    },
  });
}
