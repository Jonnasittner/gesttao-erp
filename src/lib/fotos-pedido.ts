import { db } from "@/lib/firebase-admin";
import { dataUriDoAnexo } from "@/lib/anexos-storage";

/**
 * Fotos do pedido já em base64, prontas para embutir no PDF, na ordem em que
 * foram adicionadas. Fotos cujo arquivo sumiu do storage são ignoradas.
 * Fica fora de "use server" para não virar uma ação chamável pelo navegador.
 */
export async function dataUrisFotosPedido(pedidoId: string): Promise<string[]> {
  const doc = await db.collection("pedidos").doc(pedidoId).get();
  const fotos = (doc.data()?.fotos ?? []) as { chave: string; tipo: string }[];
  const uris = await Promise.all(fotos.map((f) => dataUriDoAnexo(f.chave, f.tipo)));
  return uris.filter((uri): uri is string => Boolean(uri));
}
