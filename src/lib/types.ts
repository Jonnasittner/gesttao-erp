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

export const STATUS_PEDIDO = ["ORCAMENTO", "PEDIDO"] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

export const pedidoSchema = z.object({
  cadastroId: z.string().min(1, "Selecione o cliente"),
  cadastroNome: z.string().trim().min(1).transform((s) => s.toUpperCase()),
  itens: z.array(itemPedidoSchema).min(1, "Adicione ao menos um produto"),
  observacao: textoMaiusculoOpcional,
  status: z.enum(STATUS_PEDIDO).default("ORCAMENTO"),
});
export type PedidoInput = z.infer<typeof pedidoSchema>;

export interface Pedido extends PedidoInput {
  id: string;
  numero: number;
  total: number;
  status: StatusPedido;
  createdAt: string;
  updatedAt: string;
}

export const empresaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da empresa").transform((s) => s.toUpperCase()),
  cnpj: textoMaiusculoOpcional,
  endereco: textoMaiusculoOpcional,
  telefone: textoMaiusculoOpcional,
  instagram: z.string().trim().optional().or(z.literal("")),
  // Site e e-mail ficam em minúsculas/como digitados: endereço em caixa alta
  // atrapalha a leitura e não é o padrão de URL nem de e-mail.
  site: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  observacaoPadraoPedido: z.string().optional().or(z.literal("")),
});
export type EmpresaInput = z.infer<typeof empresaSchema>;

export interface Empresa extends EmpresaInput {
  // Logo e selo não ficam aqui — são arquivos fixos em public/empresa/,
  // lidos direto do disco (ver src/lib/imagem-empresa.ts).
  updatedAt: string;
}

// Usuários que podem entrar no sistema (coleção "usuarios"). O nome fica como
// digitado — é o nome que aparece no menu e em "Registrado por".
export const TAMANHO_MINIMO_SENHA = 6;

export const usuarioSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome"),
  email: z
    .string()
    .trim()
    .email("E-mail inválido")
    .transform((s) => s.toLowerCase()),
});
export type UsuarioInput = z.infer<typeof usuarioSchema>;

export const senhaSchema = z
  .string()
  .min(TAMANHO_MINIMO_SENHA, `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres`);

export interface Usuario extends UsuarioInput {
  id: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------

/** RECEBER = dinheiro que entra (cliente); PAGAR = dinheiro que sai (fornecedor). */
export const TIPO_LANCAMENTO = ["RECEBER", "PAGAR"] as const;
export type TipoLancamento = (typeof TIPO_LANCAMENTO)[number];

export const FORMA_PAGAMENTO = [
  "PIX",
  "DINHEIRO",
  "BOLETO",
  "CARTAO_CREDITO",
  "CARTAO_DEBITO",
  "TRANSFERENCIA",
  "CHEQUE",
] as const;
export type FormaPagamento = (typeof FORMA_PAGAMENTO)[number];

/** Tipo de custo de um lançamento a pagar (para a margem do pedido). */
export const CATEGORIA_CUSTO = ["MERCADORIA", "FRETE", "INSTALACAO", "COMISSAO", "OUTROS"] as const;
export type CategoriaCusto = (typeof CATEGORIA_CUSTO)[number];

export const STATUS_LANCAMENTO = ["PENDENTE", "PAGO"] as const;
export type StatusLancamento = (typeof STATUS_LANCAMENTO)[number];

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export const MAX_PARCELAS = 48;

/** Uma parcela da simulação. `id` vem preenchido só na edição (documento já salvo). */
export const parcelaSchema = z
  .object({
    id: z.string().optional().or(z.literal("")),
    vencimento: z.string().regex(DATA_ISO, "Informe o vencimento de todas as parcelas"),
    valor: z.coerce.number().positive("Todas as parcelas precisam ter valor maior que zero"),
    status: z.enum(STATUS_LANCAMENTO).default("PENDENTE"),
    dataPagamento: z.string().regex(DATA_ISO).optional().or(z.literal("")),
    banco: textoMaiusculoOpcional,
  })
  .superRefine((parcela, ctx) => {
    if (parcela.status === "PAGO" && !parcela.dataPagamento) {
      ctx.addIssue({ code: "custom", path: ["dataPagamento"], message: "Informe a data das parcelas recebidas/pagas" });
    }
  });
export type ParcelaInput = z.infer<typeof parcelaSchema>;

/**
 * O que o formulário envia. Nomes de cliente/fornecedor e número do pedido
 * não vêm daqui: o servidor busca pelos ids, para não gravar dado adulterado.
 * Cada parcela vira um documento em "lancamentos" com o mesmo numeroDocumento.
 */
export const lancamentoSchema = z
  .object({
    tipo: z.enum(TIPO_LANCAMENTO),
    clienteId: z.string().optional().or(z.literal("")),
    pedidoId: z.string().optional().or(z.literal("")),
    fornecedorId: z.string().optional().or(z.literal("")),
    numeroPedidoFornecedor: textoMaiusculoOpcional,
    /** Só em lançamentos a pagar. */
    categoria: z.enum(CATEGORIA_CUSTO).optional(),
    formaPagamento: z.enum(FORMA_PAGAMENTO, { error: "Selecione a forma de pagamento" }),
    valor: z.coerce.number().positive("Informe um valor maior que zero"),
    descricao: textoMaiusculoOpcional,
    parcelas: z
      .array(parcelaSchema)
      .min(1, "Informe ao menos uma parcela")
      .max(MAX_PARCELAS, `No máximo ${MAX_PARCELAS} parcelas`),
  })
  .superRefine((dados, ctx) => {
    if (dados.tipo === "RECEBER" && !dados.clienteId) {
      ctx.addIssue({ code: "custom", path: ["clienteId"], message: "Selecione o cliente" });
    }
    // Mercadoria precisa do fornecedor; frete, instalação etc. podem não ter cadastro.
    if (dados.tipo === "PAGAR" && (dados.categoria ?? "MERCADORIA") === "MERCADORIA" && !dados.fornecedorId) {
      ctx.addIssue({ code: "custom", path: ["fornecedorId"], message: "Selecione o fornecedor" });
    }
    const soma = dados.parcelas.reduce((total, p) => total + p.valor, 0);
    if (Math.abs(soma - dados.valor) > 0.009) {
      ctx.addIssue({ code: "custom", path: ["parcelas"], message: "A soma das parcelas não bate com o valor total" });
    }
  });
export type LancamentoInput = z.infer<typeof lancamentoSchema>;

/** Um documento de "lancamentos" = uma parcela. */
export interface Lancamento {
  id: string;
  /** Nº do documento gerado pelo sistema (1, 2, 3...), igual em todas as parcelas. */
  numeroDocumento: number;
  /** 1, 2, 3... */
  parcela: number;
  totalParcelas: number;
  /** Valor do documento inteiro (soma das parcelas). */
  valorTotal: number;
  tipo: TipoLancamento;
  clienteId: string;
  clienteNome: string;
  pedidoId: string;
  /** 0 quando não há pedido vinculado. */
  pedidoNumero: number;
  fornecedorId: string;
  fornecedorNome: string;
  numeroPedidoFornecedor: string;
  /** Tipo de custo (a pagar); "" em lançamentos a receber. */
  categoria: CategoriaCusto | "";
  formaPagamento: FormaPagamento;
  /** Valor desta parcela. */
  valor: number;
  /** "AAAA-MM-DD" (sem horário, para não trocar o dia por fuso). */
  vencimento: string;
  status: StatusLancamento;
  dataPagamento: string;
  /** Banco onde foi recebido/pago. */
  banco: string;
  descricao: string;
  usuarioNome: string | null;
  createdAt: string;
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
