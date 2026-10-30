import { unstable_isUnrecognizedActionError } from "next/navigation";

// Depois de um deploy, uma aba aberta com a versão anterior chama Server
// Actions que não existem mais no servidor ("Server Action ... was not found
// on the server") e a tela cai no erro geral. Nesse caso basta recarregar a
// página uma vez para pegar a versão nova. A marca na sessão evita recarregar
// em loop quando o erro é outro problema.
const MARCA_RECARGA = "gesttao-recarregou-versao";

export function ehErroDeVersaoAntiga(erro: unknown) {
  if (unstable_isUnrecognizedActionError(erro)) return true;
  const mensagem = erro instanceof Error ? erro.message : String(erro ?? "");
  return /Server Action .* was not found on the server|Failed to find Server Action/i.test(mensagem);
}

/** Recarrega a página, no máximo uma vez por minuto. Devolve se recarregou. */
export function recarregarUmaVez(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(MARCA_RECARGA) ?? 0);
    if (Date.now() - ultima < 60_000) return false;
    sessionStorage.setItem(MARCA_RECARGA, String(Date.now()));
  } catch {
    // Sem sessionStorage (aba privada etc.): recarrega mesmo assim.
  }
  window.location.reload();
  return true;
}
