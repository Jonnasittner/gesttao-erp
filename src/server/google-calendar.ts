"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { comResultado } from "@/lib/resultado";
import {
  buscarConexaoGoogle,
  conexaoRef,
  credenciaisGoogle,
  type EventoGoogle,
  limparTokenEmCache,
  listarEventosGoogle,
} from "@/lib/google-calendar";

export interface StatusGoogleCalendar {
  /** GOOGLE_CLIENT_ID/SECRET presentes no .env. */
  configurado: boolean;
  conectado: boolean;
  /** Conectada, mas o Google recusou o token: precisa reconectar. */
  expirado: boolean;
  email: string | null;
  conectadoEm: string | null;
  conectadoPor: string | null;
}

export async function buscarStatusGoogleCalendar(): Promise<StatusGoogleCalendar> {
  const conexao = await buscarConexaoGoogle();
  return {
    configurado: credenciaisGoogle() !== null,
    conectado: conexao !== null,
    expirado: conexao?.expirada ?? false,
    email: conexao?.email ?? null,
    conectadoEm: conexao?.conectadoEm ?? null,
    conectadoPor: conexao?.conectadoPor ?? null,
  };
}

/** Eventos do Google Calendar no período, para a tela de Agenda. */
export async function buscarEventosGoogle(timeMin: string, timeMax: string) {
  return comResultado<EventoGoogle[]>(async () => {
    const session = await auth();
    if (!session?.user) throw new Error("Não autenticado");
    return listarEventosGoogle(timeMin, timeMax);
  });
}

export async function desconectarGoogleCalendar() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const conexao = await buscarConexaoGoogle();
  if (conexao) {
    // Revoga o acesso no Google também; se falhar (token já revogado), segue.
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(conexao.refreshToken)}`, {
      method: "POST",
    }).catch(() => undefined);
  }

  await conexaoRef().delete();
  limparTokenEmCache();
  revalidatePath("/configuracoes");
  revalidatePath("/agendamentos");
}
