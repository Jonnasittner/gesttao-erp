"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { excluirArquivoAnexo, salvarAnexo } from "@/lib/anexos-storage";
import type { Anexo } from "@/lib/types";

const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10MB por arquivo

export async function enviarAnexos(cadastroId: string, interacaoId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const arquivos = formData
    .getAll("arquivos")
    .filter((valor): valor is File => valor instanceof File && valor.size > 0);

  if (arquivos.length === 0) return;

  for (const arquivo of arquivos) {
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
      throw new Error(`"${arquivo.name}" passa do limite de 10MB por arquivo.`);
    }
  }

  for (const arquivo of arquivos) {
    const chave = `${cadastroId}/${interacaoId}/${randomUUID()}-${arquivo.name}`;
    const buffer = Buffer.from(await arquivo.arrayBuffer());

    await salvarAnexo(chave, buffer);

    await db.collection("anexos").add({
      interacaoId,
      cadastroId,
      chaveBlob: chave,
      nomeArquivo: arquivo.name,
      tipo: arquivo.type || "application/octet-stream",
      tamanho: arquivo.size,
      usuarioId: session.user.id,
      usuarioNome: session.user.name ?? null,
      createdAt: new Date(),
    });
  }

  revalidatePath(`/cadastros/${cadastroId}`);
}

export async function listarAnexosPorCadastro(cadastroId: string): Promise<Anexo[]> {
  const snap = await db.collection("anexos").where("cadastroId", "==", cadastroId).get();
  const docs = [...snap.docs].sort(
    (a, b) => (a.data().createdAt?.toMillis?.() ?? 0) - (b.data().createdAt?.toMillis?.() ?? 0)
  );

  return docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      interacaoId: data.interacaoId,
      cadastroId: data.cadastroId,
      nomeArquivo: data.nomeArquivo,
      tipo: data.tipo,
      tamanho: data.tamanho,
      url: `/api/anexos/${doc.id}`,
      usuarioNome: data.usuarioNome ?? null,
      createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
    };
  });
}

export async function excluirAnexo(id: string, cadastroId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const doc = await db.collection("anexos").doc(id).get();
  const chave = doc.data()?.chaveBlob;
  if (chave) {
    await excluirArquivoAnexo(chave);
  }
  await doc.ref.delete();

  revalidatePath(`/cadastros/${cadastroId}`);
}
