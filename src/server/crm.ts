"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { type Interacao, type InteracaoInput, interacaoSchema, type EtapaAtendimento } from "@/lib/types";

function toInteracao(doc: FirebaseFirestore.QueryDocumentSnapshot): Interacao {
  const data = doc.data();
  return {
    id: doc.id,
    cadastroId: data.cadastroId,
    tipo: data.tipo,
    descricao: data.descricao,
    data: data.data?.toDate?.().toISOString() ?? data.data,
    dataReagendamento: data.dataReagendamento?.toDate?.().toISOString() ?? "",
    valorEstimado: data.valorEstimado ?? 0,
    etapa: data.etapa ?? "NOVO",
    usuarioId: data.usuarioId ?? null,
    usuarioNome: data.usuarioNome ?? null,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
  };
}

export async function listarInteracoes(): Promise<Interacao[]> {
  const snap = await db.collection("interacoes").orderBy("createdAt", "desc").get();
  return snap.docs.map(toInteracao);
}

export async function listarInteracoesPorCadastro(cadastroId: string): Promise<Interacao[]> {
  // Ordenado em memória (em vez de .orderBy no Firestore) para não depender
  // de um índice composto (cadastroId + data): o volume por cadastro é baixo.
  const snap = await db.collection("interacoes").where("cadastroId", "==", cadastroId).get();
  return snap.docs.map(toInteracao).sort((a, b) => b.data.localeCompare(a.data));
}

export async function criarInteracao(input: InteracaoInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const parsed = interacaoSchema.parse(input);
  const ref = await db.collection("interacoes").add({
    ...parsed,
    data: new Date(parsed.data),
    dataReagendamento: parsed.dataReagendamento ? new Date(parsed.dataReagendamento) : null,
    usuarioId: session.user.id,
    usuarioNome: session.user.name ?? null,
    createdAt: new Date(),
  });

  revalidatePath(`/cadastros/${parsed.cadastroId}`);
  revalidatePath("/crm");
  return { id: ref.id };
}

export async function atualizarInteracao(id: string, input: InteracaoInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const parsed = interacaoSchema.parse(input);
  await db.collection("interacoes").doc(id).update({
    tipo: parsed.tipo,
    descricao: parsed.descricao,
    data: new Date(parsed.data),
    valorEstimado: parsed.valorEstimado,
    etapa: parsed.etapa,
  });

  revalidatePath(`/cadastros/${parsed.cadastroId}`);
  revalidatePath("/crm");
}

export async function reagendarInteracao(id: string, cadastroId: string, dataReagendamento: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  await db
    .collection("interacoes")
    .doc(id)
    .update({ dataReagendamento: dataReagendamento ? new Date(dataReagendamento) : null });

  revalidatePath(`/cadastros/${cadastroId}`);
}

export async function atualizarEtapaInteracao(id: string, etapa: EtapaAtendimento) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  await db.collection("interacoes").doc(id).update({ etapa });
  revalidatePath("/crm");
}
