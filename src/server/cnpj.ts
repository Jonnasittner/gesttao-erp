"use server";

import { auth } from "@/lib/auth";
import { formatarTelefone } from "@/lib/telefone";

/**
 * Consulta pública de CNPJ (BrasilAPI, que serve os dados abertos da Receita
 * Federal — a mesma origem de sites como o CNPJ Biz). Usada para preencher
 * sozinho o cadastro do cliente.
 */

export interface DadosCnpj {
  nome: string;
  nomeFantasia: string;
  telefone: string;
  email: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  ramoAtividade: string;
  /** "ATIVA", "BAIXADA", "SUSPENSA"... como vem da Receita. */
  situacao: string;
}

export type ResultadoCnpj = { ok: true; dados: DadosCnpj } | { ok: false; erro: string };

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

export async function consultarCnpj(documento: string): Promise<ResultadoCnpj> {
  const session = await auth();
  if (!session?.user) return { ok: false, erro: "Não autenticado" };

  const cnpj = documento.replace(/\D/g, "");
  if (cnpj.length !== 14) return { ok: false, erro: "Informe os 14 dígitos do CNPJ." };

  let resposta: Response;
  try {
    resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      // Sem User-Agent a API responde 403.
      headers: { "User-Agent": "Gesttao-ERP", Accept: "application/json" },
      // Dado público e estável: vale guardar por um dia para não repetir consulta.
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, erro: "Não foi possível consultar o CNPJ agora. Tente de novo." };
  }

  if (resposta.status === 400) return { ok: false, erro: "CNPJ inválido — confira os números." };
  if (resposta.status === 404) return { ok: false, erro: "CNPJ não encontrado na Receita Federal." };
  if (resposta.status === 429) return { ok: false, erro: "Muitas consultas seguidas. Aguarde um instante." };
  if (!resposta.ok) return { ok: false, erro: "A consulta de CNPJ falhou. Tente de novo." };

  const dados = (await resposta.json()) as Record<string, unknown>;

  // O logradouro vem sem o tipo ("VITORIA"), que fica num campo separado ("RUA").
  const tipoLogradouro = texto(dados.descricao_tipo_de_logradouro);
  const logradouro = texto(dados.logradouro);
  const endereco = [tipoLogradouro, logradouro].filter(Boolean).join(" ");

  const telefone = texto(dados.ddd_telefone_1) || texto(dados.ddd_telefone_2);

  return {
    ok: true,
    dados: {
      nome: texto(dados.razao_social),
      nomeFantasia: texto(dados.nome_fantasia),
      telefone: formatarTelefone(telefone),
      email: texto(dados.email).toLowerCase(),
      endereco,
      numero: texto(dados.numero),
      complemento: texto(dados.complemento),
      bairro: texto(dados.bairro),
      cidade: texto(dados.municipio),
      estado: texto(dados.uf),
      cep: texto(dados.cep),
      ramoAtividade: texto(dados.cnae_fiscal_descricao),
      situacao: texto(dados.descricao_situacao_cadastral),
    },
  };
}
