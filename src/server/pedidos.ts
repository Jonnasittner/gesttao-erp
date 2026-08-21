"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { proximoNumero } from "@/lib/contador";
import { type Pedido, type PedidoInput, pedidoSchema } from "@/lib/types";

function toPedido(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): Pedido {
  const data = doc.data()!;
  return {
    id: doc.id,
    numero: data.numero,
    cadastroId: data.cadastroId,
    cadastroNome: data.cadastroNome,
    itens: data.itens ?? [],
    total: data.total ?? 0,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? "",
  };
}

export async function listarPedidos(): Promise<Pedido[]> {
  const snap = await db.collection("pedidos").orderBy("createdAt", "desc").get();
  return snap.docs.map(toPedido);
}

export async function buscarPedido(id: string): Promise<Pedido | null> {
  const doc = await db.collection("pedidos").doc(id).get();
  if (!doc.exists) return null;
  return toPedido(doc);
}

export async function criarPedido(input: PedidoInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const parsed = pedidoSchema.parse(input);
  const total = parsed.itens.reduce((soma, item) => soma + item.quantidade * item.precoUnitario, 0);
  const numero = await proximoNumero("pedido_numero");
  const now = new Date();

  const ref = await db.collection("pedidos").add({
    ...parsed,
    numero,
    total,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/pedidos");
  return { id: ref.id, numero };
}

export async function excluirPedido(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  await db.collection("pedidos").doc(id).delete();

  revalidatePath("/pedidos");
}
