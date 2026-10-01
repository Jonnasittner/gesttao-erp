"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { criarCadastro } from "@/server/cadastros";
import { LINHAS, SEGMENTOS_POR_ID, normalizarNome, type Lead } from "@/lib/leads";

/**
 * Apoio da tela de Geração de Leads. A busca em si roda no navegador (as APIs
 * públicas de mapa são lentas para o tempo limite das funções); aqui ficam só
 * as partes que precisam do banco.
 */

/** Nomes já cadastrados, normalizados, para não oferecer quem já é cliente. */
export async function listarNomesCadastrados(): Promise<string[]> {
  const session = await auth();
  if (!session?.user) return [];

  const snap = await db.collection("cadastros").select("nome").get();
  return snap.docs.map((doc) => normalizarNome(doc.data().nome ?? "")).filter(Boolean);
}

/** Cidades e estados já usados nos cadastros, para sugerir na busca. */
export async function listarCidadesCadastradas(): Promise<{ cidade: string; estado: string; quantos: number }[]> {
  const session = await auth();
  if (!session?.user) return [];

  const snap = await db.collection("cadastros").select("cidade", "estado").get();
  const contagem = new Map<string, { cidade: string; estado: string; quantos: number }>();

  for (const doc of snap.docs) {
    const cidade = (doc.data().cidade ?? "").trim();
    if (!cidade) continue;
    const estado = (doc.data().estado ?? "").trim();
    const chave = `${cidade}|${estado}`;
    const atual = contagem.get(chave);
    if (atual) atual.quantos += 1;
    else contagem.set(chave, { cidade, estado, quantos: 1 });
  }

  return [...contagem.values()].sort((a, b) => b.quantos - a.quantos);
}

/**
 * Grava o lead como cadastro de cliente, já com o segmento no ramo de
 * atividade e a lista de produtos sugeridos na observação do contato.
 */
export async function salvarLeadComoCadastro(lead: Lead, linhasSugeridas: string[]) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const segmento = SEGMENTOS_POR_ID.get(lead.segmentoId);
  const produtos = linhasSugeridas
    .map((chave) => LINHAS[chave]?.nome)
    .filter(Boolean)
    .join(", ");

  const partes = ["LEAD ENCONTRADO NA GERAÇÃO DE LEADS"];
  if (produtos) partes.push(`OFERECER: ${produtos}`);
  if (lead.site) partes.push(`SITE: ${lead.site}`);
  // O cadastro tem um campo de telefone e um de e-mail; o resto fica anotado.
  if (lead.telefones.length > 1) partes.push(`OUTROS TELEFONES: ${lead.telefones.slice(1).join(" / ")}`);
  if (lead.emails.length > 1) partes.push(`OUTROS E-MAILS: ${lead.emails.slice(1).join(" / ")}`);

  return criarCadastro({
    nome: lead.nome,
    documento: lead.cnpj,
    telefone: lead.telefones[0] ?? "",
    email: lead.emails[0] ?? "",
    endereco: lead.endereco,
    numero: lead.numero,
    complemento: "",
    bairro: lead.bairro,
    cidade: lead.cidade,
    estado: lead.estado,
    nomeContato: "",
    observacaoContato: partes.join(" | "),
    tipos: ["CLIENTE"],
    ramoAtividade: segmento?.nome ?? "",
    status: "ATIVO",
  });
}
