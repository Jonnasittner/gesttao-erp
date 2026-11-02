import { db } from "@/lib/firebase-admin";
import type { ClasseDespesa } from "@/lib/types";

// Plano de contas das despesas: cada documento de "classesDespesa" é uma
// classe com as subclasses dentro (lista pequena, um documento só por classe).
// Os lançamentos a pagar guardam classeId/subclasseId e os nomes do momento.
//
// Não é um arquivo "use server": é usado pelas actions do Financeiro, da
// Conciliação e de src/server/classes-despesa.ts.

export function classesDespesaRef() {
  return db.collection("classesDespesa");
}

function toClasse(doc: FirebaseFirestore.DocumentSnapshot): ClasseDespesa {
  const d = doc.data()!;
  return {
    id: doc.id,
    nome: d.nome ?? "",
    ativa: d.ativa !== false,
    subclasses: ((d.subclasses ?? []) as { id: string; nome?: string; ativa?: boolean }[]).map((s) => ({
      id: s.id,
      nome: s.nome ?? "",
      ativa: s.ativa !== false,
    })),
  };
}

/** Todas as classes (ativas e inativas), em ordem alfabética, subclasses também. */
export async function carregarClassesDespesa(): Promise<ClasseDespesa[]> {
  const snap = await classesDespesaRef().get();
  return snap.docs
    .map(toClasse)
    .map((c) => ({ ...c, subclasses: [...c.subclasses].sort((a, b) => a.nome.localeCompare(b.nome)) }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

/**
 * Confere que a classe e a subclasse existem (e que a subclasse é daquela
 * classe) e devolve os campos gravados no lançamento.
 */
export async function camposDaClasse(classeId: string, subclasseId: string) {
  const doc = classeId ? await classesDespesaRef().doc(classeId).get() : null;
  if (!doc?.exists) throw new Error("Classe da despesa não encontrada.");
  const classe = toClasse(doc);
  const sub = classe.subclasses.find((s) => s.id === subclasseId);
  if (!sub) throw new Error("A subclasse escolhida não é dessa classe.");
  return { classeId: classe.id, classeNome: classe.nome, subclasseId: sub.id, subclasseNome: sub.nome };
}
