"use server";

import { db } from "@/lib/firebase-admin";

export interface SugestoesEndereco {
  endereco: string[];
  numero: string[];
  complemento: string[];
  bairro: string[];
  cidade: string[];
  estado: string[];
  estadoPorCidade: Record<string, string>;
  ramoAtividade: string[];
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
  const complemento: string[] = [];
  const bairro: string[] = [];
  const cidade: string[] = [];
  const estado: string[] = [];
  const estadoPorCidade: Record<string, string> = {};
  const ramoAtividade: string[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.endereco) endereco.push(data.endereco);
    if (data.numero) numero.push(data.numero);
    if (data.complemento) complemento.push(data.complemento);
    if (data.bairro) bairro.push(data.bairro);
    if (data.cidade) cidade.push(data.cidade);
    if (data.estado) estado.push(data.estado);
    // Última ocorrência prevalece — suficiente para preencher o estado
    // automaticamente quando a cidade já foi cadastrada antes.
    if (data.cidade && data.estado) estadoPorCidade[data.cidade] = data.estado;
    if (data.ramoAtividade) ramoAtividade.push(data.ramoAtividade);
  }

  return {
    endereco: distinctOrdenado(endereco),
    numero: distinctOrdenado(numero),
    complemento: distinctOrdenado(complemento),
    bairro: distinctOrdenado(bairro),
    cidade: distinctOrdenado(cidade),
    estado: distinctOrdenado(estado),
    estadoPorCidade,
    ramoAtividade: distinctOrdenado(ramoAtividade),
  };
}
