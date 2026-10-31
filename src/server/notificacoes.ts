"use server";

import { FieldValue } from "firebase-admin/firestore";
import { auth } from "@/lib/auth";
import { comResultado } from "@/lib/resultado";
import { db } from "@/lib/firebase-admin";
import { type Notificacao, notificacoesRef } from "@/lib/notificacoes";
import { conferirCobrancasEmAberto } from "@/lib/asaas";
import { revalidatePath } from "next/cache";

async function exigirUsuario() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado");
  return session.user.id;
}

/**
 * Notificações marcando quais o usuário logado já viu. Sem `desde`, as 20
 * mais recentes (ao abrir a tela); com `desde` (ISO da mais nova que a tela
 * já tem), só as que chegaram depois — a consulta periódica custa 1 leitura
 * no Firestore quando não há nada novo, em vez de reler todas.
 */
export async function listarNotificacoes(desde?: string) {
  return comResultado<Notificacao[]>(async () => {
    const usuarioId = await exigirUsuario();
    // Aproveita a consulta periódica das telas abertas para conferir no Asaas
    // as cobranças em aberto (no máximo a cada 3 min). Pagamento achado aqui
    // já cria a notificação lida logo abaixo.
    const baixas = await conferirCobrancasEmAberto().catch((err) => {
      console.error("[asaas] falha na conferência", err);
      return 0;
    });
    if (baixas > 0) revalidatePath("/financeiro");
    const aPartir = desde ? new Date(desde) : null;
    const consulta =
      aPartir && !Number.isNaN(aPartir.getTime())
        ? notificacoesRef().where("criadaEm", ">", aPartir).orderBy("criadaEm", "desc").limit(20)
        : notificacoesRef().orderBy("criadaEm", "desc").limit(20);
    const snap = await consulta.get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        titulo: data.titulo ?? "",
        mensagem: data.mensagem ?? "",
        link: data.link ?? "",
        criadaEm: data.criadaEm?.toDate?.().toISOString() ?? "",
        lida: (data.lidaPor ?? []).includes(usuarioId),
      };
    });
  });
}

/** Marca as notificações como vistas pelo usuário logado. */
export async function marcarNotificacoesLidas(ids: string[]) {
  return comResultado(async () => {
    const usuarioId = await exigirUsuario();
    if (ids.length === 0) return;
    const lote = db.batch();
    for (const id of ids.slice(0, 100)) {
      lote.update(notificacoesRef().doc(id), { lidaPor: FieldValue.arrayUnion(usuarioId) });
    }
    await lote.commit();
  });
}
