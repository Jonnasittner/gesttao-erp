import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/firebase-admin";
import { type PagamentoAsaas, sincronizarCobrancaAsaas } from "@/lib/asaas";

// Webhook de cobranças do Asaas (Integrações > Webhooks no painel do Asaas).
// O token configurado lá vem no header "asaas-access-token" e precisa bater
// com ASAAS_WEBHOOK_TOKEN. Fora token inválido, sempre responde 200: com
// erro, o Asaas pausa a fila de webhooks inteira.

function tokenValido(recebido: string | null) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!tokenValido(request.headers.get("asaas-access-token"))) {
    return NextResponse.json({ erro: "token inválido" }, { status: 401 });
  }

  const corpo = (await request.json().catch(() => null)) as {
    event?: string;
    payment?: PagamentoAsaas & { externalReference?: string | null };
  } | null;
  const evento = corpo?.event;
  const pagamento = corpo?.payment;
  if (!pagamento?.id) return NextResponse.json({ ok: true });

  // externalReference é o id do lançamento; se não vier, procura pelo id da cobrança.
  let lancamentoId = pagamento.externalReference ?? null;
  if (!lancamentoId) {
    const snap = await db.collection("lancamentos").where("asaas.id", "==", pagamento.id).limit(1).get();
    lancamentoId = snap.docs[0]?.id ?? null;
  }
  if (!lancamentoId) return NextResponse.json({ ok: true });

  const doc = await db.collection("lancamentos").doc(lancamentoId).get();
  if (!doc.exists || doc.data()!.asaas?.id !== pagamento.id) return NextResponse.json({ ok: true });

  try {
    if (evento === "PAYMENT_DELETED") {
      await db.collection("lancamentos").doc(lancamentoId).update({ asaas: null, updatedAt: new Date() });
    } else {
      // O payload do webhook tem o mesmo formato do GET /payments/{id}.
      await sincronizarCobrancaAsaas(lancamentoId, pagamento);
    }
  } catch (err) {
    // Responde 200 mesmo assim: erro faz o Asaas pausar a fila inteira. O botão
    // "Atualizar" da cobrança relê o status direto do Asaas.
    console.error("[asaas] falha ao processar webhook", evento, pagamento.id, err);
  }

  revalidatePath("/financeiro");
  if (doc.data()!.pedidoId) revalidatePath(`/pedidos/${doc.data()!.pedidoId}`);
  return NextResponse.json({ ok: true });
}
