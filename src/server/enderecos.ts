"use server";

import { db } from "@/lib/firebase-admin";

export interface SugestoesEndereco {
  endereco: string[];
  numero: string[];
  bairro: string[];
  cidade: string[];
}

function distinctOrdenado(valores: Iterable<string>): string[] {
  return [...new Set(valores)].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * Valores distintos já usados em cadastros existentes, para alimentar os
 * campos de endereço com sugestões (não restringe a digitação livre).
 */
export async function listarSugestoesEndereco(): Promise<SugestoesEndereco> {
  const snap = await db.collection("cadastros").get();

  const endereco: string[] = [];
  const numero: string[] = [];
  const bairro: string[] = [];
  const cidade: string[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.endereco) endereco.push(data.endereco);
    if (data.numero) numero.push(data.numero);
    if (data.bairro) bairro.push(data.bairro);
    if (data.cidade) cidade.push(data.cidade);
  }

  return {
    endereco: distinctOrdenado(endereco),
    numero: distinctOrdenado(numero),
    bairro: distinctOrdenado(bairro),
    cidade: distinctOrdenado(cidade),
  };
}
