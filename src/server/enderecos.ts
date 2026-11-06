"use server";

import { db } from "@/lib/firebase-admin";
import { montarSugestoesEndereco, type SugestoesEndereco } from "@/lib/sugestoes-endereco";

export type { SugestoesEndereco } from "@/lib/sugestoes-endereco";

/**
 * Valores distintos já usados em cadastros existentes, para alimentar os
 * campos de endereço com sugestões (não restringe a digitação livre).
 */
export async function listarSugestoesEndereco(): Promise<SugestoesEndereco> {
  const snap = await db.collection("cadastros").get();
  return montarSugestoesEndereco(snap.docs.map((doc) => doc.data()));
}
