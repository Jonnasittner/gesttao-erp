"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import {
  type Atendimento,
  type EtapaAtendimento,
  ETAPAS_FECHADAS,
  type Interacao,
  type InteracaoInput,
  interacaoSchema,
} from "@/lib/types";

function toInteracao(doc: FirebaseFirestore.QueryDocumentSnapshot): Interacao {
  const data = doc.data();
  return {
    id: doc.id,
    // Interações criadas antes do agrupamento por atendimento não têm esse
    // campo — cada uma vira seu próprio atendimento de um item só.
    atendimentoId: data.atendimentoId ?? doc.id,
    cadastroId: data.cadastroId,
    tipo: data.tipo,
    descricao: data.descricao,
    data: data.data?.toDate?.().toISOString() ?? data.data,
    // Guardado como string literal (não Timestamp): "AAAA-MM-DD" (dia
    // inteiro) ou "AAAA-MM-DDTHH:mm" (horário específico) — um Timestamp
    // normalizaria os dois formatos e faria o Firestore interpretar a data
    // pura como meia-noite UTC, adiantando/atrasando um dia em fusos como o
    // do Brasil.
    dataReagendamento: data.dataReagendamento ?? "",
    valorEstimado: data.valorEstimado ?? 0,
    etapa: data.etapa ?? "NOVO",
    usuarioId: data.usuarioId ?? null,
    usuarioNome: data.usuarioNome ?? null,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
  };
}

/** Agrupa interações pelo atendimento a que pertencem, mais recente primeiro. */
function agruparPorAtendimento(interacoes: Interacao[]): Atendimento[] {
  const grupos = new Map<string, Interacao[]>();
  for (const interacao of interacoes) {
    const lista = grupos.get(interacao.atendimentoId) ?? [];
    lista.push(interacao);
    grupos.set(interacao.atendimentoId, lista);
  }

  const atendimentos: Atendimento[] = [];
  for (const [atendimentoId, lista] of grupos) {
    // Ordenado por createdAt (quando foi registrado), não pela data do
    // atendimento: duas interações podem ter a mesma data/hora de
    // atendimento (ex.: campo "Data" não alterado entre dois registros
    // seguidos), e createdAt sempre cresce, então nunca empata.
    const ordenadas = [...lista].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const maisRecente = ordenadas[ordenadas.length - 1];
    // Valor estimado "gruda": uma interação de acompanhamento sem valor
    // preenchido não deve apagar o valor já registrado antes no atendimento.
    const comValor = [...ordenadas].reverse().find((i) => i.valorEstimado > 0);

    atendimentos.push({
      atendimentoId,
      cadastroId: maisRecente.cadastroId,
      etapa: maisRecente.etapa,
      valorEstimado: comValor?.valorEstimado ?? 0,
      primeiraData: ordenadas[0].data,
      ultimaData: maisRecente.data,
      interacoes: ordenadas,
    });
  }

  return atendimentos.sort((a, b) => {
    const ultimoA = a.interacoes[a.interacoes.length - 1].createdAt;
    const ultimoB = b.interacoes[b.interacoes.length - 1].createdAt;
    return ultimoB.localeCompare(ultimoA);
  });
}

/** Reaproveita o atendimento em aberto do cadastro, ou inicia um novo se o último já estiver fechado. */
async function resolverAtendimentoId(cadastroId: string): Promise<string> {
  const snap = await db.collection("interacoes").where("cadastroId", "==", cadastroId).get();
  if (snap.empty) return randomUUID();

  const [ultimo] = agruparPorAtendimento(snap.docs.map(toInteracao));
  return ultimo && !ETAPAS_FECHADAS.includes(ultimo.etapa) ? ultimo.atendimentoId : randomUUID();
}

export async function listarInteracoes(): Promise<Interacao[]> {
  const snap = await db.collection("interacoes").orderBy("createdAt", "desc").get();
  return snap.docs.map(toInteracao);
}

export async function listarAtendimentos(): Promise<Atendimento[]> {
  return agruparPorAtendimento(await listarInteracoes());
}

export async function listarInteracoesPorCadastro(cadastroId: string): Promise<Interacao[]> {
  // Ordenado em memória (em vez de .orderBy no Firestore) para não depender
  // de um índice composto (cadastroId + data): o volume por cadastro é baixo.
  const snap = await db.collection("interacoes").where("cadastroId", "==", cadastroId).get();
  return snap.docs.map(toInteracao).sort((a, b) => b.data.localeCompare(a.data));
}

export async function listarAtendimentosPorCadastro(cadastroId: string): Promise<Atendimento[]> {
  return agruparPorAtendimento(await listarInteracoesPorCadastro(cadastroId));
}

export async function criarInteracao(input: InteracaoInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const parsed = interacaoSchema.parse(input);
  const atendimentoId = await resolverAtendimentoId(parsed.cadastroId);

  const ref = await db.collection("interacoes").add({
    ...parsed,
    atendimentoId,
    data: new Date(parsed.data),
    dataReagendamento: parsed.dataReagendamento || null,
    usuarioId: session.user.id,
    usuarioNome: session.user.name ?? null,
    createdAt: new Date(),
  });

  revalidatePath(`/cadastros/${parsed.cadastroId}`);
  revalidatePath("/crm");
  return { id: ref.id };
}

export async function atualizarInteracao(id: string, input: InteracaoInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const parsed = interacaoSchema.parse(input);
  await db.collection("interacoes").doc(id).update({
    tipo: parsed.tipo,
    descricao: parsed.descricao,
    data: new Date(parsed.data),
    valorEstimado: parsed.valorEstimado,
    etapa: parsed.etapa,
  });

  revalidatePath(`/cadastros/${parsed.cadastroId}`);
  revalidatePath("/crm");
}

export async function reagendarInteracao(id: string, cadastroId: string, dataReagendamento: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  await db
    .collection("interacoes")
    .doc(id)
    .update({ dataReagendamento: dataReagendamento || null });

  revalidatePath(`/cadastros/${cadastroId}`);
}

export async function atualizarEtapaInteracao(id: string, etapa: EtapaAtendimento) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  await db.collection("interacoes").doc(id).update({ etapa });
  revalidatePath("/crm");
}
