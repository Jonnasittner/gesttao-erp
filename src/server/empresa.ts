"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { type Empresa, type EmpresaInput, empresaSchema } from "@/lib/types";

function empresaRef() {
  return db.collection("configuracoes").doc("empresa");
}

export async function buscarEmpresa(): Promise<Empresa | null> {
  const doc = await empresaRef().get();
  if (!doc.exists) return null;

  const data = doc.data()!;
  return {
    nome: data.nome ?? "",
    cnpj: data.cnpj ?? "",
    endereco: data.endereco ?? "",
    telefone: data.telefone ?? "",
    email: data.email ?? "",
    site: data.site ?? "",
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? "",
  };
}

export async function salvarEmpresa(input: EmpresaInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const parsed = empresaSchema.parse(input);
  await empresaRef().set({ ...parsed, updatedAt: new Date() }, { merge: true });

  revalidatePath("/configuracoes");
  revalidatePath("/pedidos");
}
