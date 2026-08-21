"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { proximoNumero } from "@/lib/contador";
import { type Cadastro, type CadastroInput, type TipoCadastro, cadastroSchema } from "@/lib/types";

function toCadastro(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): Cadastro {
  const data = doc.data()!;
  return {
    id: doc.id,
    codigo: data.codigo,
    nome: data.nome,
    documento: data.documento ?? "",
    telefone: data.telefone ?? "",
    email: data.email ?? "",
    endereco: data.endereco ?? "",
    numero: data.numero ?? "",
    complemento: data.complemento ?? "",
    bairro: data.bairro ?? "",
    cidade: data.cidade ?? "",
    estado: data.estado ?? "",
    nomeContato: data.nomeContato ?? "",
    observacaoContato: data.observacaoContato ?? "",
    tipos: data.tipos ?? [],
    ramoAtividade: data.ramoAtividade ?? "",
    status: data.status,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? "",
  };
}

export async function listarCadastros(tipo?: TipoCadastro): Promise<Cadastro[]> {
  const query = tipo
    ? db.collection("cadastros").where("tipos", "array-contains", tipo)
    : db.collection("cadastros");

  const snap = await query.get();
  // Ordenado em memória (em vez de .orderBy no Firestore) para não depender
  // de um índice composto quando o filtro por tipo está ativo.
  return snap.docs.map(toCadastro).sort((a, b) => b.codigo - a.codigo);
}

export async function buscarCadastro(id: string): Promise<Cadastro | null> {
  const doc = await db.collection("cadastros").doc(id).get();
  if (!doc.exists) return null;
  return toCadastro(doc);
}

export async function criarCadastro(input: CadastroInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const parsed = cadastroSchema.parse(input);
  const codigo = await proximoNumero("cadastro_codigo");
  const now = new Date();

  const ref = await db.collection("cadastros").add({
    ...parsed,
    codigo,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/cadastros");
  return { id: ref.id, codigo };
}

export async function atualizarCadastro(id: string, input: CadastroInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const parsed = cadastroSchema.parse(input);
  await db
    .collection("cadastros")
    .doc(id)
    .update({ ...parsed, updatedAt: new Date() });

  revalidatePath("/cadastros");
  revalidatePath(`/cadastros/${id}`);
}
