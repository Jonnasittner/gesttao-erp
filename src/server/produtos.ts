"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { dataUriDoAnexo, excluirArquivoAnexo, salvarAnexo } from "@/lib/anexos-storage";
import { proximoNumero } from "@/lib/contador";
import { type Produto, type ProdutoInput, produtoSchema } from "@/lib/types";

const TAMANHO_MAXIMO_IMAGEM_BYTES = 5 * 1024 * 1024; // 5MB

function toProduto(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): Produto {
  const data = doc.data()!;
  return {
    id: doc.id,
    nome: data.nome,
    preco: data.preco ?? 0,
    codigoFornecedor: data.codigoFornecedor ?? "",
    codigoInterno: data.codigoInterno ?? 0,
    custoM2: data.custoM2 ?? 0,
    observacao: data.observacao ?? "",
    imagemUrl: data.imagemChave ? `/api/produtos/${doc.id}/imagem` : "",
    createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? "",
  };
}

export async function listarProdutos(): Promise<Produto[]> {
  const snap = await db.collection("produtos").get();
  return snap.docs.map(toProduto).sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function buscarProduto(id: string): Promise<Produto | null> {
  const doc = await db.collection("produtos").doc(id).get();
  if (!doc.exists) return null;
  return toProduto(doc);
}

/** Imagem do produto já em base64, pronta pra embutir num PDF (ver src/lib/pedido-pdf.tsx). */
export async function dataUriImagemProduto(id: string): Promise<string | null> {
  const doc = await db.collection("produtos").doc(id).get();
  const data = doc.data();
  return dataUriDoAnexo(data?.imagemChave, data?.imagemTipo);
}

export async function criarProduto(input: ProdutoInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const parsed = produtoSchema.parse(input);
  const codigoInterno = await proximoNumero("produto_codigo_interno");
  const now = new Date();
  const ref = await db
    .collection("produtos")
    .add({ ...parsed, codigoInterno, createdAt: now, updatedAt: now });

  revalidatePath("/pedidos");
  revalidatePath("/produtos");
  return { id: ref.id, nome: parsed.nome, preco: parsed.preco, custoM2: parsed.custoM2 };
}

export async function atualizarProduto(id: string, input: ProdutoInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const parsed = produtoSchema.parse(input);
  await db
    .collection("produtos")
    .doc(id)
    .update({ ...parsed, updatedAt: new Date() });

  revalidatePath("/pedidos");
  revalidatePath("/produtos");
}

export async function excluirProduto(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const ref = db.collection("produtos").doc(id);
  const doc = await ref.get();
  const chaveImagem = doc.data()?.imagemChave as string | undefined;

  await ref.delete();
  if (chaveImagem) {
    await excluirArquivoAnexo(chaveImagem);
  }

  revalidatePath("/pedidos");
  revalidatePath("/produtos");
}

export async function enviarImagemProduto(produtoId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const arquivo = formData.get("imagem");
  if (!(arquivo instanceof File) || arquivo.size === 0) return;

  if (arquivo.size > TAMANHO_MAXIMO_IMAGEM_BYTES) {
    throw new Error("A imagem passa do limite de 5MB.");
  }
  if (!arquivo.type.startsWith("image/")) {
    throw new Error("Envie um arquivo de imagem.");
  }

  const ref = db.collection("produtos").doc(produtoId);
  const doc = await ref.get();
  const chaveAnterior = doc.data()?.imagemChave as string | undefined;

  const chave = `produtos/${produtoId}/${randomUUID()}-${arquivo.name}`;
  const buffer = Buffer.from(await arquivo.arrayBuffer());
  await salvarAnexo(chave, buffer);

  await ref.update({ imagemChave: chave, imagemTipo: arquivo.type, updatedAt: new Date() });

  if (chaveAnterior) {
    await excluirArquivoAnexo(chaveAnterior);
  }

  revalidatePath("/produtos");
  revalidatePath("/pedidos");
}
