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

/** As 30 mais recentes, marcando quais o usuário logado já viu. */
export async function listarNotificacoes() {
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
    const snap = await notificacoesRef().orderBy("criadaEm", "desc").limit(30).get();
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
