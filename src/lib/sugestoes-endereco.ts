/** Valores já usados em cadastros, para sugerir nos campos (não restringe a digitação livre). */
export interface SugestoesEndereco {
  nome: string[];
  endereco: string[];
  numero: string[];
  complemento: string[];
  bairro: string[];
  cidade: string[];
  estado: string[];
  estadoPorCidade: Record<string, string>;
  ramoAtividade: string[];
}

type CampoTexto = Exclude<keyof SugestoesEndereco, "estadoPorCidade">;

function distinctOrdenado(valores: Iterable<string>): string[] {
  return [...new Set(valores)].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * Monta as sugestões a partir de cadastros já lidos. Serve tanto para a
 * leitura completa (tela de cadastro) quanto para reaproveitar os clientes
 * que outra tela já carregou, sem nova leitura no Firestore.
 */
export function montarSugestoesEndereco(
  cadastros: Iterable<Partial<Record<CampoTexto, unknown>>>,
): SugestoesEndereco {
  const campos: CampoTexto[] = ["nome", "endereco", "numero", "complemento", "bairro", "cidade", "estado", "ramoAtividade"];
  const valores = Object.fromEntries(campos.map((c) => [c, [] as string[]])) as Record<CampoTexto, string[]>;
  const estadoPorCidade: Record<string, string> = {};

  for (const cadastro of cadastros) {
    for (const campo of campos) {
      const valor = cadastro[campo];
      if (typeof valor === "string" && valor) valores[campo].push(valor);
    }
    // Última ocorrência prevalece — suficiente para preencher o estado
    // automaticamente quando a cidade já foi cadastrada antes.
    if (typeof cadastro.cidade === "string" && cadastro.cidade && typeof cadastro.estado === "string" && cadastro.estado) {
      estadoPorCidade[cadastro.cidade] = cadastro.estado;
    }
  }

  return {
    nome: distinctOrdenado(valores.nome),
    endereco: distinctOrdenado(valores.endereco),
    numero: distinctOrdenado(valores.numero),
    complemento: distinctOrdenado(valores.complemento),
    bairro: distinctOrdenado(valores.bairro),
    cidade: distinctOrdenado(valores.cidade),
    estado: distinctOrdenado(valores.estado),
    estadoPorCidade,
    ramoAtividade: distinctOrdenado(valores.ramoAtividade),
  };
}
