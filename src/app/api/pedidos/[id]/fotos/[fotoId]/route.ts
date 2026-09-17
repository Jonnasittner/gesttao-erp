import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { lerAnexo } from "@/lib/anexos-storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; fotoId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Não autenticado", { status: 401 });
  }

  const { id, fotoId } = await params;
  const doc = await db.collection("pedidos").doc(id).get();
  const foto = ((doc.data()?.fotos ?? []) as { id: string; chave: string; tipo: string }[]).find(
    (f) => f.id === fotoId
  );
  if (!foto) {
    return new NextResponse("Foto não encontrada", { status: 404 });
  }

  const conteudo = await lerAnexo(foto.chave);
  if (!conteudo) {
    return new NextResponse("Arquivo não encontrado no storage", { status: 404 });
  }

  return new NextResponse(new Blob([Uint8Array.from(conteudo)]), {
    headers: {
      "Content-Type": foto.tipo || "image/jpeg",
      // A foto de um id nunca muda (trocar = apagar e enviar outra).
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}
