"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { type RamoAtividade, type RamoAtividadeInput, ramoAtividadeSchema } from "@/lib/types";

function toRamoAtividade(doc: FirebaseFirestore.QueryDocumentSnapshot): RamoAtividade {
  const data = doc.data();
  return {
    id: doc.id,
    nome: data.nome,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
  };
}

export async function listarRamosAtividade(): Promise<RamoAtividade[]> {
  const snap = await db.collection("ramosAtividade").get();
  return snap.docs.map(toRamoAtividade).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function criarRamoAtividade(input: RamoAtividadeInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const parsed = ramoAtividadeSchema.parse(input);
  const ref = await db.collection("ramosAtividade").add({ ...parsed, createdAt: new Date() });

  revalidatePath("/cadastros");
  return { id: ref.id };
}

export async function atualizarRamoAtividade(id: string, input: RamoAtividadeInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const parsed = ramoAtividadeSchema.parse(input);
  await db.collection("ramosAtividade").doc(id).update(parsed);

  revalidatePath("/cadastros");
}

export async function excluirRamoAtividade(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  await db.collection("ramosAtividade").doc(id).delete();

  revalidatePath("/cadastros");
}
