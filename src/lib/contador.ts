import { db } from "@/lib/firebase-admin";

export type ChaveContador = "cadastro_codigo" | "pedido_numero" | "produto_codigo_interno";

/**
 * Incrementa atomicamente um contador (contadores/{chave}) e retorna o novo
 * valor. Usado para gerar código de cliente e número de pedido sem colisão
 * entre cadastros simultâneos.
 */
export async function proximoNumero(chave: ChaveContador): Promise<number> {
  const ref = db.collection("contadores").doc(chave);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const atual = (snap.data()?.valor as number | undefined) ?? 0;
    const proximo = atual + 1;
    tx.set(ref, { valor: proximo }, { merge: true });
    return proximo;
  });
}
