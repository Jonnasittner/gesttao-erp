// Mapas de rótulo compartilhados entre Server Components e Client Components.
// Importante: NÃO colocar "use client" neste arquivo — um valor exportado de
// um módulo client pode virar `undefined` quando importado por um Server
// Component (o Next.js só garante o boundary para o próprio componente).

import type { ETAPA_ATENDIMENTO, TIPO_CADASTRO, TIPO_INTERACAO } from "@/lib/types";

export const ROTULOS_TIPO_CADASTRO: Record<(typeof TIPO_CADASTRO)[number], string> = {
  CLIENTE: "Cliente",
  FORNECEDOR: "Fornecedor / Prestador de serviço",
  INTERNO: "Cadastro interno",
};

export const CORES_TIPO_CADASTRO: Record<(typeof TIPO_CADASTRO)[number], string> = {
  CLIENTE:
    "border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/40 dark:text-green-300",
  FORNECEDOR:
    "border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  INTERNO:
    "border-purple-200 bg-purple-100 text-purple-800 dark:border-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

export const CORES_TIPO_CADASTRO_ATIVO: Record<(typeof TIPO_CADASTRO)[number], string> = {
  CLIENTE: "border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-500",
  FORNECEDOR: "border-orange-600 bg-orange-600 text-white dark:border-orange-500 dark:bg-orange-500",
  INTERNO: "border-purple-600 bg-purple-600 text-white dark:border-purple-500 dark:bg-purple-500",
};

export const ROTULOS_TIPO_INTERACAO: Record<(typeof TIPO_INTERACAO)[number], string> = {
  LIGACAO: "Ligação",
  WHATSAPP: "WhatsApp",
  VISITA: "Visita",
  NOTA: "Nota",
};

export const ROTULOS_ETAPA_ATENDIMENTO: Record<(typeof ETAPA_ATENDIMENTO)[number], string> = {
  NOVO: "Chamar",
  AGUARDANDO_RETORNO: "Aguardando Retorno",
  QUALIFICADO: "Agendado",
  AG_ORCAMENTO_FABRICA: "Ag. Orç. Fábrica",
  PROPOSTA: "Enviado Proposta",
  GANHO: "Pedido Feito",
  PERDIDO: "Pedido Perdido",
  FINALIZADO: "Finalizado",
};
