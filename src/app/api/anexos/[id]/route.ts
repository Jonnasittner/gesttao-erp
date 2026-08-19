import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { lerAnexo } from "@/lib/anexos-storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Não autenticado", { status: 401 });
  }

  const { id } = await params;
  const doc = await db.collection("anexos").doc(id).get();
  if (!doc.exists) {
    return new NextResponse("Anexo não encontrado", { status: 404 });
  }

  const data = doc.data()!;
  const conteudo = await lerAnexo(data.chaveBlob);
  if (!conteudo) {
    return new NextResponse("Arquivo não encontrado no storage", { status: 404 });
  }

  return new NextResponse(conteudo, {
    headers: {
      "Content-Type": data.tipo || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(data.nomeArquivo)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
