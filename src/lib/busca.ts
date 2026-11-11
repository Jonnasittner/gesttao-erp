// Busca de texto usada no servidor e no navegador (sem "use client" de propósito).

/** Minúsculas e sem acento, para "joao" achar "João". */
export function normalizarBusca(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Texto em que a busca de pedidos procura: nome do cliente e número ("12" e "0012"). */
export function chaveBusca(nome: string, numero: number, codigo: string): string {
  return normalizarBusca(`${nome} ${numero} ${codigo}`);
}

/** Cada palavra digitada precisa aparecer: "maria 12" acha a Maria do pedido 12. */
export function atendeTexto(chave: string, texto: string): boolean {
  return normalizarBusca(texto)
    .split(/\s+/)
    .every((parte) => chave.includes(parte));
}
