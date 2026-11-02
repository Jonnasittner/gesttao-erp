"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { comResultado } from "@/lib/resultado";
import { carregarClassesDespesa, classesDespesaRef } from "@/lib/classes-despesa";
import { type ClasseDespesa, nomeClasseSchema } from "@/lib/types";

async function exigirSessao() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");
}

function revalidar() {
  revalidatePath("/financeiro", "layout");
}

function lerNome(nome: string) {
  const r = nomeClasseSchema.safeParse(nome);
  if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Nome inválido.");
  return r.data;
}

export async function listarClassesDespesa(): Promise<ClasseDespesa[]> {
  await exigirSessao();
  return carregarClassesDespesa();
}

/** Lê a classe dentro da transação; erro se não existir. */
async function lerClasse(t: FirebaseFirestore.Transaction, classeId: string) {
  const ref = classesDespesaRef().doc(classeId);
  const doc = await t.get(ref);
  if (!doc.exists) throw new Error("Classe não encontrada.");
  const subclasses = (doc.data()!.subclasses ?? []) as { id: string; nome: string; ativa?: boolean }[];
  return { ref, nome: doc.data()!.nome as string, subclasses };
}

function mesmoNome(a: string, b: string) {
  return a.localeCompare(b, "pt-BR", { sensitivity: "base" }) === 0;
}

export async function criarClasse(nome: string) {
  return comResultado(async () => {
    await exigirSessao();
    const limpo = lerNome(nome);
    const existentes = await carregarClassesDespesa();
    if (existentes.some((c) => mesmoNome(c.nome, limpo))) throw new Error(`Já existe a classe ${limpo}.`);
    const ref = await classesDespesaRef().add({ nome: limpo, ativa: true, subclasses: [], createdAt: new Date() });
    revalidar();
    return ref.id;
  });
}

export async function renomearClasse(classeId: string, nome: string) {
  return comResultado(async () => {
    await exigirSessao();
    const limpo = lerNome(nome);
    const existentes = await carregarClassesDespesa();
    if (existentes.some((c) => c.id !== classeId && mesmoNome(c.nome, limpo))) {
      throw new Error(`Já existe a classe ${limpo}.`);
    }
    await classesDespesaRef().doc(classeId).update({ nome: limpo });
    revalidar();
  });
}

export async function alterarClasseAtiva(classeId: string, ativa: boolean) {
  return comResultado(async () => {
    await exigirSessao();
    await classesDespesaRef().doc(classeId).update({ ativa });
    revalidar();
  });
}

/** Só exclui classe sem nenhum lançamento; usada em lançamento, só dá para inativar. */
export async function excluirClasse(classeId: string) {
  return comResultado(async () => {
    await exigirSessao();
    const uso = await db.collection("lancamentos").where("classeId", "==", classeId).limit(1).get();
    if (!uso.empty) throw new Error("Esta classe já tem lançamentos. Inative em vez de excluir.");
    await classesDespesaRef().doc(classeId).delete();
    revalidar();
  });
}

export async function criarSubclasse(classeId: string, nome: string) {
  return comResultado(async () => {
    await exigirSessao();
    const limpo = lerNome(nome);
    await db.runTransaction(async (t) => {
      const classe = await lerClasse(t, classeId);
      if (classe.subclasses.some((s) => mesmoNome(s.nome, limpo))) {
        throw new Error(`${classe.nome} já tem a subclasse ${limpo}.`);
      }
      t.update(classe.ref, { subclasses: [...classe.subclasses, { id: randomUUID(), nome: limpo, ativa: true }] });
    });
    revalidar();
  });
}

export async function renomearSubclasse(classeId: string, subclasseId: string, nome: string) {
  return comResultado(async () => {
    await exigirSessao();
    const limpo = lerNome(nome);
    await db.runTransaction(async (t) => {
      const classe = await lerClasse(t, classeId);
      if (classe.subclasses.some((s) => s.id !== subclasseId && mesmoNome(s.nome, limpo))) {
        throw new Error(`${classe.nome} já tem a subclasse ${limpo}.`);
      }
      t.update(classe.ref, {
        subclasses: classe.subclasses.map((s) => (s.id === subclasseId ? { ...s, nome: limpo } : s)),
      });
    });
    revalidar();
  });
}

export async function alterarSubclasseAtiva(classeId: string, subclasseId: string, ativa: boolean) {
  return comResultado(async () => {
    await exigirSessao();
    await db.runTransaction(async (t) => {
      const classe = await lerClasse(t, classeId);
      t.update(classe.ref, {
        subclasses: classe.subclasses.map((s) => (s.id === subclasseId ? { ...s, ativa } : s)),
      });
    });
    revalidar();
  });
}

export async function excluirSubclasse(classeId: string, subclasseId: string) {
  return comResultado(async () => {
    await exigirSessao();
    const uso = await db.collection("lancamentos").where("subclasseId", "==", subclasseId).limit(1).get();
    if (!uso.empty) throw new Error("Esta subclasse já tem lançamentos. Inative em vez de excluir.");
    await db.runTransaction(async (t) => {
      const classe = await lerClasse(t, classeId);
      t.update(classe.ref, { subclasses: classe.subclasses.filter((s) => s.id !== subclasseId) });
    });
    revalidar();
  });
}

/** Ponto de partida para quem ainda não tem classes: dá para renomear e apagar depois. */
const SUGERIDAS: Record<string, string[]> = {
  "MERCADORIAS": ["COMPRA DE MERCADORIA", "FRETE DE COMPRA"],
  "LOGÍSTICA": ["FRETE DE ENTREGA", "TRANSPORTADORA", "COMBUSTÍVEL"],
  "INSTALAÇÃO E SERVIÇOS": ["INSTALADORES", "MATERIAL DE INSTALAÇÃO"],
  "PESSOAL": ["SALÁRIOS", "COMISSÕES", "ENCARGOS", "BENEFÍCIOS"],
  "ADMINISTRATIVO": ["ALUGUEL", "ENERGIA", "ÁGUA", "INTERNET E TELEFONE", "CONTABILIDADE", "SISTEMAS E ASSINATURAS", "MATERIAL DE ESCRITÓRIO"],
  "COMERCIAL E MARKETING": ["ANÚNCIOS", "MATERIAL DE DIVULGAÇÃO"],
  "IMPOSTOS": ["IMPOSTOS SOBRE VENDAS", "OUTROS IMPOSTOS E TAXAS"],
  "FINANCEIRO": ["TARIFAS BANCÁRIAS E ASAAS", "JUROS E MULTAS", "EMPRÉSTIMOS"],
};

export async function criarClassesSugeridas() {
  return comResultado(async () => {
    await exigirSessao();
    const existentes = await carregarClassesDespesa();
    if (existentes.length > 0) throw new Error("Já existem classes cadastradas.");
    const lote = db.batch();
    const agora = new Date();
    for (const [nome, subs] of Object.entries(SUGERIDAS)) {
      lote.set(classesDespesaRef().doc(), {
        nome,
        ativa: true,
        subclasses: subs.map((s) => ({ id: randomUUID(), nome: s, ativa: true })),
        createdAt: agora,
      });
    }
    await lote.commit();
    revalidar();
  });
}
