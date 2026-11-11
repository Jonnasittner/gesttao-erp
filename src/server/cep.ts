"use server";

import { auth } from "@/lib/auth";

/**
 * Consulta pública de CEP (ViaCEP, dados dos Correios). Usada para preencher
 * sozinho o endereço no cadastro do cliente.
 */

export interface DadosCep {
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export type ResultadoCep = { ok: true; dados: DadosCep } | { ok: false; erro: string };

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

export async function consultarCep(cepDigitado: string): Promise<ResultadoCep> {
  const session = await auth();
  if (!session?.user) return { ok: false, erro: "Não autenticado" };

  const cep = cepDigitado.replace(/\D/g, "");
  if (cep.length !== 8) return { ok: false, erro: "Informe os 8 dígitos do CEP." };

  let resposta: Response;
  try {
    resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { Accept: "application/json" },
      // Endereço de um CEP quase nunca muda: vale guardar por uma semana.
      next: { revalidate: 604800 },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return { ok: false, erro: "Não foi possível consultar o CEP agora. Tente de novo." };
  }

  if (resposta.status === 400) return { ok: false, erro: "CEP inválido — confira os números." };
  if (!resposta.ok) return { ok: false, erro: "A consulta de CEP falhou. Tente de novo." };

  const dados = (await resposta.json()) as Record<string, unknown>;
  // O ViaCEP responde 200 com { erro: true } quando o CEP não existe.
  if (dados.erro) return { ok: false, erro: "CEP não encontrado." };

  return {
    ok: true,
    dados: {
      cep: texto(dados.cep),
      endereco: texto(dados.logradouro),
      bairro: texto(dados.bairro),
      cidade: texto(dados.localidade),
      estado: texto(dados.uf),
    },
  };
}
