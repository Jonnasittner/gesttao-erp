import { z } from "zod";

export const STATUS_CLIENTE = ["ATIVO", "INATIVO"] as const;
export type StatusCliente = (typeof STATUS_CLIENTE)[number];

export const TIPO_CADASTRO = ["CLIENTE", "FORNECEDOR", "INTERNO"] as const;
export type TipoCadastro = (typeof TIPO_CADASTRO)[number];

export const TIPO_INTERACAO = ["LIGACAO", "WHATSAPP", "VISITA", "NOTA"] as const;
export type TipoInteracao = (typeof TIPO_INTERACAO)[number];

export const ETAPA_ATENDIMENTO = [
  "NOVO",
  "AGUARDANDO_RETORNO",
  "QUALIFICADO",
  "AG_ORCAMENTO_FABRICA",
  "PROPOSTA",
  "GANHO",
  "PERDIDO",
  "FINALIZADO",
] as const;
export type EtapaAtendimento = (typeof ETAPA_ATENDIMENTO)[number];

// Etapas que encerram um atendimento: a próxima interação registrada para o
// mesmo cadastro começa um atendimento novo em vez de continuar este.
export const ETAPAS_FECHADAS: readonly EtapaAtendimento[] = ["GANHO", "PERDIDO", "FINALIZADO"];

// Todo texto livre é gravado em maiúsculas (padrão pedido para o sistema).
// E-mail fica de fora: e-mail em maiúsculas é incomum e não ajuda em nada.
const textoMaiusculo = z.string().trim().transform((s) => s.toUpperCase());
const textoMaiusculoOpcional = textoMaiusculo.optional().or(z.literal(""));

export const cadastroSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome").transform((s) => s.toUpperCase()),
  documento: textoMaiusculoOpcional,
  telefone: textoMaiusculoOpcional,
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  endereco: textoMaiusculoOpcional,
  numero: textoMaiusculoOpcional,
  complemento: textoMaiusculoOpcional,
  bairro: textoMaiusculoOpcional,
  cidade: textoMaiusculoOpcional,
  estado: textoMaiusculoOpcional,
  nomeContato: textoMaiusculoOpcional,
  observacaoContato: textoMaiusculoOpcional,
  tipos: z.array(z.enum(TIPO_CADASTRO)).min(1, "Selecione ao menos um tipo"),
  ramoAtividade: textoMaiusculoOpcional,
  status: z.enum(STATUS_CLIENTE).default("ATIVO"),
});
export type CadastroInput = z.infer<typeof cadastroSchema>;

export interface Cadastro extends CadastroInput {
  id: string;
  codigo: number;
  createdAt: string;
  updatedAt: string;
}

export const interacaoSchema = z.object({
  cadastroId: z.string().min(1),
  tipo: z.enum(TIPO_INTERACAO),
  descricao: z.string().trim().min(1, "Descreva a interação").transform((s) => s.toUpperCase()),
  data: z.string().min(1, "Informe a data"),
  dataReagendamento: z.string().optional().or(z.literal("")),
  valorEstimado: z.coerce.number().min(0, "Valor não pode ser negativo").optional().default(0),
  etapa: z.enum(ETAPA_ATENDIMENTO).default("NOVO"),
});
export type InteracaoInput = z.infer<typeof interacaoSchema>;

export interface Interacao extends InteracaoInput {
  id: string;
  atendimentoId: string;
  usuarioId: string | null;
  usuarioNome: string | null;
  createdAt: string;
}

/**
 * Um atendimento agrupa todas as interações registradas em sequência para
 * um cadastro, até que uma delas chegue numa etapa fechada (ETAPAS_FECHADAS)
 * — a próxima interação depois disso inicia um atendimento novo. Etapa e
 * valor estimado do atendimento vêm da interação mais recente do grupo.
 */
export interface Atendimento {
  atendimentoId: string;
  cadastroId: string;
  etapa: EtapaAtendimento;
  valorEstimado: number;
  primeiraData: string;
  ultimaData: string;
  interacoes: Interacao[];
}

export const produtoSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome").transform((s) => s.toUpperCase()),
  preco: z.coerce.number().min(0, "Preço não pode ser negativo"),
  codigoFornecedor: textoMaiusculoOpcional,
  custoM2: z.coerce.number().min(0, "Custo não pode ser negativo").optional().default(0),
  observacao: textoMaiusculoOpcional,
});
export type ProdutoInput = z.infer<typeof produtoSchema>;

export interface Produto extends ProdutoInput {
  id: string;
  // Gerado automaticamente na criação (a partir de 1) — não é editável.
  codigoInterno: number;
  // "" quando o produto não tem imagem cadastrada.
  imagemUrl: string;
  createdAt: string;
  updatedAt: string;
}

export const itemPedidoSchema = z.object({
  produtoId: z.string().min(1, "Selecione um produto"),
  produtoNome: z.string().trim().min(1).transform((s) => s.toUpperCase()),
  quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero"),
  // Comprimento/largura são do pedido, não do produto: cada item pode ser
  // cortado numa medida diferente do mesmo produto no catálogo.
  comprimento: z.coerce.number().min(0, "Comprimento não pode ser negativo").optional().default(0),
  largura: z.coerce.number().min(0, "Largura não pode ser negativo").optional().default(0),
  precoUnitario: z.coerce.number().min(0, "Preço não pode ser negativo"),
});
export type ItemPedidoInput = z.infer<typeof itemPedidoSchema>;

export const pedidoSchema = z.object({
  cadastroId: z.string().min(1, "Selecione o cliente"),
  cadastroNome: z.string().trim().min(1).transform((s) => s.toUpperCase()),
  itens: z.array(itemPedidoSchema).min(1, "Adicione ao menos um produto"),
});
export type PedidoInput = z.infer<typeof pedidoSchema>;

export interface Pedido extends PedidoInput {
  id: string;
  numero: number;
  total: number;
  createdAt: string;
  updatedAt: string;
}

export const empresaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da empresa").transform((s) => s.toUpperCase()),
  cnpj: textoMaiusculoOpcional,
  endereco: textoMaiusculoOpcional,
  telefone: textoMaiusculoOpcional,
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  // Sem maiúsculas (como e-mail): URL em caixa alta é incomum e não ajuda.
  site: z.string().trim().optional().or(z.literal("")),
});
export type EmpresaInput = z.infer<typeof empresaSchema>;

export interface Empresa extends EmpresaInput {
  // Logo e selo não ficam aqui — são arquivos fixos em public/empresa/,
  // lidos direto do disco (ver src/lib/imagem-empresa.ts).
  updatedAt: string;
}

export interface Anexo {
  id: string;
  interacaoId: string;
  cadastroId: string;
  nomeArquivo: string;
  tipo: string;
  tamanho: number;
  url: string;
  usuarioNome: string | null;
  createdAt: string;
}
