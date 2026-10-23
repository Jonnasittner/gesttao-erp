// Em produção o Next esconde a mensagem de erros lançados dentro de server
// actions (o navegador só recebe "Minified React error #441"). Para a tela
// mostrar o motivo real ("Cadastre o CPF...", "Asaas não configurado"...),
// as actions devolvem o erro como valor e o cliente relança com a mensagem.

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string };

/** Usado nas server actions: roda e devolve o resultado ou a mensagem do erro. */
export async function comResultado<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, dados: await fn() };
  } catch (err) {
    console.error(err);
    return { ok: false, erro: err instanceof Error ? err.message : "Erro inesperado." };
  }
}

/** Usado no cliente: devolve os dados ou lança um Error com a mensagem real. */
export function desembrulhar<T>(resultado: Resultado<T>): T {
  if (!resultado.ok) throw new Error(resultado.erro);
  return resultado.dados;
}
