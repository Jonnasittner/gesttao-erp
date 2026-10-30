import { toast } from "sonner";

// Downloads dos boletos do Asaas pela rota /api/financeiro/[id]/boletos, que
// dá nome ao arquivo: "CLIENTE - Pedido 0837 - Parcela 2.pdf" (uma parcela)
// ou "... - Todas parcelas.pdf" (todas juntas). Usado no pop-up da conta a
// receber, na janela do Cobrar e nos boletos das parcelas do pedido.

/** Boleto de uma parcela (`parcela`) ou de todas juntas (sem `parcela`). */
export function urlBoleto(lancamentoId: string, parcela?: number) {
  const base = `/api/financeiro/${lancamentoId}/boletos`;
  return parcela ? `${base}?parcela=${parcela}` : base;
}

/**
 * Um arquivo por parcela. Um download de cada vez, com uma pausa: o navegador
 * barra vários juntos (o Chrome pergunta uma vez se pode baixar vários).
 */
export async function baixarBoletosSeparados(parcelas: { id: string; parcela: number }[]) {
  toast.info(`Baixando ${parcelas.length} boletos…`);
  for (const p of parcelas) {
    const link = document.createElement("a");
    link.href = urlBoleto(p.id, p.parcela);
    link.download = "";
    document.body.appendChild(link);
    link.click();
    link.remove();
    await new Promise((r) => setTimeout(r, 800));
  }
}
