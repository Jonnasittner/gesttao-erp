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
  "PROPOSTA",
  "GANHO",
  "PERDIDO",
] as const;
export type EtapaAtendimento = (typeof ETAPA_ATENDIMENTO)[number];

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
  bairro: textoMaiusculoOpcional,
  cidade: textoMaiusculoOpcional,
  nomeContato: textoMaiusculoOpcional,
  observacaoContato: textoMaiusculoOpcional,
  tipos: z.array(z.enum(TIPO_CADASTRO)).min(1, "Selecione ao menos um tipo"),
  ramoAtividadeId: z.string().optional().or(z.literal("")),
  status: z.enum(STATUS_CLIENTE).default("ATIVO"),
});
export type CadastroInput = z.infer<typeof cadastroSchema>;

export interface Cadastro extends CadastroInput {
  id: string;
  codigo: number;
  createdAt: string;
  updatedAt: string;
}

export const ramoAtividadeSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do ramo de atividade").transform((s) => s.toUpperCase()),
});
export type RamoAtividadeInput = z.infer<typeof ramoAtividadeSchema>;

export interface RamoAtividade extends RamoAtividadeInput {
  id: string;
  createdAt: string;
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
  usuarioId: string | null;
  usuarioNome: string | null;
  createdAt: string;
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
