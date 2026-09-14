"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import {
  type Usuario,
  type UsuarioInput,
  senhaSchema,
  usuarioSchema,
} from "@/lib/types";

function usuarios() {
  return db.collection("usuarios");
}

async function exigirSessao() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");
  return session;
}

// Nunca devolve o senhaHash para a tela.
function toUsuario(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): Usuario {
  const data = doc.data()!;
  return {
    id: doc.id,
    nome: data.nome ?? "",
    email: data.email ?? "",
    createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
  };
}

async function emailEmUso(email: string, ignorarId?: string): Promise<boolean> {
  const snap = await usuarios().where("email", "==", email).limit(2).get();
  return snap.docs.some((doc) => doc.id !== ignorarId);
}

export async function listarUsuarios(): Promise<Usuario[]> {
  await exigirSessao();
  const snap = await usuarios().get();
  return snap.docs.map(toUsuario).sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function criarUsuario(input: UsuarioInput & { senha: string }) {
  await exigirSessao();

  const dados = usuarioSchema.parse(input);
  const senha = senhaSchema.parse(input.senha);

  if (await emailEmUso(dados.email)) {
    throw new Error("Já existe um usuário com esse e-mail.");
  }

  await usuarios().add({
    ...dados,
    senhaHash: await bcrypt.hash(senha, 10),
    createdAt: new Date(),
  });

  revalidatePath("/configuracoes");
}

export async function atualizarUsuario(id: string, input: UsuarioInput) {
  await exigirSessao();

  const dados = usuarioSchema.parse(input);

  if (await emailEmUso(dados.email, id)) {
    throw new Error("Já existe um usuário com esse e-mail.");
  }

  await usuarios().doc(id).update(dados);
  revalidatePath("/configuracoes");
}

export async function alterarSenhaUsuario(id: string, novaSenha: string) {
  await exigirSessao();

  const senha = senhaSchema.parse(novaSenha);
  await usuarios().doc(id).update({ senhaHash: await bcrypt.hash(senha, 10) });
}

export async function excluirUsuario(id: string) {
  const session = await exigirSessao();

  if (session.user.id === id) {
    throw new Error("Você não pode remover o seu próprio acesso.");
  }

  const snap = await usuarios().get();
  if (snap.size <= 1) {
    throw new Error("O sistema precisa ter pelo menos um usuário.");
  }

  await usuarios().doc(id).delete();
  revalidatePath("/configuracoes");
}
