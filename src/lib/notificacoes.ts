import { db } from "@/lib/firebase-admin";

// Notificações da equipe (o planeta no topo da tela). Uma notificação vale
// para todos os usuários; quem já viu fica em "lidaPor" (ids de usuário).
//
// Não é um arquivo "use server": criarNotificacao é chamado pelo webhook do
// Asaas e por outros helpers do servidor. As actions ficam em src/server/notificacoes.ts.

export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  /** Para onde leva o clique (ex.: "/financeiro?tipo=RECEBER&status=pagos"). */
  link: string;
  /** ISO. */
  criadaEm: string;
  lida: boolean;
}

export function notificacoesRef() {
  return db.collection("notificacoes");
}

/**
 * Grava uma notificação. `chave` evita duplicar a mesma (ex.: o Asaas manda
 * PAYMENT_CONFIRMED e depois PAYMENT_RECEIVED da mesma cobrança).
 */
export async function criarNotificacao(dados: { chave: string; titulo: string; mensagem: string; link: string }) {
  const { chave, ...resto } = dados;
  await notificacoesRef()
    .doc(chave)
    .create({ ...resto, criadaEm: new Date(), lidaPor: [] })
    .catch((err: { code?: number }) => {
      // 6 = ALREADY_EXISTS: já notificado.
      if (err.code !== 6) throw err;
    });
}
