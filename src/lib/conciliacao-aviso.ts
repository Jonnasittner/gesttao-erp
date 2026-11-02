// Constantes da Conciliação que a tela (client) também usa. Ficam fora de
// src/lib/conciliacao.ts, que importa o firebase-admin e só roda no servidor.

export const LINK_CONCILIACAO = "/financeiro/conciliacao";

/**
 * Evento do navegador que o planeta das notificações dispara quando chega
 * movimentação nova para conciliar; o menu acende um ponto no item.
 */
export const EVENTO_CONCILIACAO = "gesttao:conciliacao-nova";
