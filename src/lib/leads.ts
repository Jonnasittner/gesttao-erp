/**
 * Base da tela de Geração de Leads.
 *
 * São três coisas aqui:
 *  1. As linhas de produto que a empresa vende (tabela Kapazi Cooperkap).
 *  2. Os segmentos de cliente que compram cada linha.
 *  3. Como montar e ler a busca no OpenStreetMap (Overpass), que é a fonte
 *     pública de empresas usada para encontrar os leads.
 *
 * Tudo aqui é puro (sem servidor e sem banco) porque a busca roda no navegador:
 * as APIs públicas são lentas demais para o limite de tempo das funções do
 * Netlify.
 */

import { formatarCpfCnpj } from "@/lib/documento";

export interface LinhaProduto {
  nome: string;
  resumo: string;
  /** Como o produto costuma ser escrito no cadastro, para achar a foto dele. */
  termos?: string[];
}

/** Linhas de produto conforme a tabela de preços do fornecedor. */
export const LINHAS: Record<string, LinhaProduto> = {
  VINIL: { nome: "Tapete de vinil personalizado", resumo: "Capacho com a marca do cliente, 10mm ou 14mm alto tráfego." },
  CLEANKAP: { nome: "Cleankap", resumo: "Tapete em nylon com impressão de imagens, para entradas e recepções internas." },
  WATERKAP: { nome: "Waterkap", resumo: "Tapete de borracha para entradas de condomínios e comércios." },
  WATERKAP_ELITE: { nome: "Waterkap Elite", resumo: "Versão mais densa e resistente, para entradas de alto fluxo.", termos: ["waterkap elite"] },
  FIREKAP: { nome: "Firekap", resumo: "Sinalização de extintores e alarmes (NBR 12.693 e NPT 20), substitui pintura." },
  FIBRA_COCO: { nome: "Fibra de coco", resumo: "Capacho de entrada, alta retenção de sujeira e antiderrapante.", termos: ["fibra de coco"] },
  SUPERIOR: { nome: "Superior", resumo: "Piso modular para entradas e portarias, instalável sobre o piso ou em rebaixo." },
  ITALY_ELEGANCE: { nome: "Italy Elegance", resumo: "Tapete decorativo em nylon para salas de reunião, recepções e lounges.", termos: ["italy"] },
  CONECTADO: { nome: "Conectado", resumo: "Tapete em perfil de alumínio para portas de acesso de grande circulação." },
  PROTEPISO: { nome: "Protepiso", resumo: "Protetor transparente do piso contra cadeiras de rodinha." },
  RUBBERKAP: { nome: "Rubberkap", resumo: "Piso emborrachado para academias, playgrounds, tatames e fisioterapia." },
  BARBERKAP: { nome: "Barberkap", resumo: "Tapete antifadiga para salões de beleza e barbearias." },
  ANTIFADIGA: { nome: "Antifadiga", resumo: "Tapete NR-17 para quem trabalha em pé; reduz o cansaço em até 50%." },
  YOGAKAP: { nome: "Yogakap", resumo: "Tapete de yoga e alongamento." },
  ACQUAKAP: { nome: "Acquakap", resumo: "Piso modular antiderrapante para áreas úmidas e molhadas." },
  H_KAP: { nome: "H-Kap", resumo: "Rolo antiderrapante de alta resistência para vestiários, piscinas e indústria." },
  S_KAP: { nome: "S-Kap", resumo: "Rolo antiderrapante para áreas molhadas, academias e vestiários." },
  W_KAP: { nome: "W-Kap", resumo: "Rolo antiderrapante e antifúngico para locais molhados." },
  DUO: { nome: "Duo", resumo: "Tapete corporativo de tráfego médio com base antiderrapante." },
  DUO_OPERA: { nome: "Duo Ópera", resumo: "Tapete premium para escritórios, clínicas, hotéis, escolas e igrejas.", termos: ["duo opera"] },
  LAMINADO: { nome: "Laminado (Moeda, Liso e Bus)", resumo: "Piso em rolo para áreas industriais, academias, decks e rampas.", termos: ["laminado", "piso moeda"] },
  TERRA: { nome: "Tapete Terra", resumo: "Barreira contra sujeira pesada em obras, galpões e oficinas." },
  FITA_DEMARCACAO: { nome: "Fita de demarcação", resumo: "Demarcação de áreas, filas, quadras e pontos de extintor.", termos: ["fita de demarcacao", "fita demarcacao"] },
  FITA_ANTIDERRAPANTE: { nome: "Fita antiderrapante", resumo: "Aplicada em escadas, rampas e passarelas contra escorregões.", termos: ["fita antiderrapante"] },
  PISO_TATIL: { nome: "Piso tátil", resumo: "Alerta e direcional em PVC para acessibilidade (NBR 9050).", termos: ["piso tatil"] },
  LIFTKAP: { nome: "Liftkap (capa de elevador)", resumo: "Capa de elevador em nylon, protege a cabine em mudanças e obras.", termos: ["Liftkap", "capa de elevador"] },
  WIND_BANNER: { nome: "Wind banner", resumo: "Bandeira de publicidade para fachadas, feiras e pontos de venda.", termos: ["wind banner"] },
  GRAMA_DECORATIVA: { nome: "Grama sintética decorativa", resumo: "12mm, 20mm e 30mm para áreas comuns, varandas e fachadas.", termos: ["grama sintetica", "grama decorativa"] },
  GRAMA_ESPORTIVA: { nome: "Grama sintética esportiva", resumo: "Monofilamento 50mm para campos e quadras.", termos: ["grama esportiva"] },
  PLAYKAP: { nome: "Playkap", resumo: "Piso modular colorido para playgrounds e quadras poliesportivas." },
  DECK_MODULAR: { nome: "Deck modular", resumo: "Placas que se encaixam, para varandas, piscinas e áreas externas.", termos: ["deck"] },
  AUTOMOTIVO: { nome: "Tapetes automotivos", resumo: "Linha automotiva personalizada para veículos e showroom.", termos: ["automotivo", "porta malas", "porta-malas"] },
};

export type ChaveLinha = keyof typeof LINHAS;

/** Regra de busca no OpenStreetMap: uma etiqueta e os valores que interessam. */
interface RegraOsm {
  chave: string;
  valores?: string[];
}

export interface Segmento {
  id: string;
  nome: string;
  descricao: string;
  /** 3 = compra recorrente e ticket alto; 1 = oportunidade pontual. */
  prioridade: 1 | 2 | 3;
  regras: RegraOsm[];
  produtos: { linha: ChaveLinha; motivo: string }[];
}

export const SEGMENTOS: Segmento[] = [
  {
    id: "condominio",
    nome: "Condomínios e prédios",
    descricao: "Edifícios residenciais e comerciais com portaria, elevador e área comum.",
    prioridade: 3,
    regras: [
      { chave: "building", valores: ["apartments", "residential"] },
      { chave: "residential", valores: ["condominium", "apartments"] },
    ],
    produtos: [
      { linha: "LIFTKAP", motivo: "Toda mudança de morador precisa proteger a cabine do elevador." },
      { linha: "PISO_TATIL", motivo: "Acessibilidade obrigatória na entrada e nas rampas (NBR 9050)." },
      { linha: "VINIL", motivo: "Capacho personalizado com o nome do condomínio na portaria." },
      { linha: "WATERKAP", motivo: "Retém a areia e a água na entrada do hall." },
      { linha: "FIREKAP", motivo: "Sinalização dos extintores exigida pelo corpo de bombeiros." },
      { linha: "FITA_ANTIDERRAPANTE", motivo: "Escadas e rampas da garagem sem risco de queda." },
      { linha: "GRAMA_DECORATIVA", motivo: "Área de lazer e playground sem manutenção de jardim." },
      { linha: "PLAYKAP", motivo: "Piso seguro no playground interno." },
      { linha: "DECK_MODULAR", motivo: "Borda de piscina e varandas da área comum." },
      { linha: "RUBBERKAP", motivo: "Academia do condomínio precisa de piso emborrachado." },
    ],
  },
  {
    id: "administradora",
    nome: "Administradoras e imobiliárias",
    descricao: "Quem administra vários condomínios — um contato abre muitos prédios.",
    prioridade: 3,
    regras: [
      { chave: "office", valores: ["estate_agent", "property_management"] },
      { chave: "shop", valores: ["estate_agent"] },
    ],
    produtos: [
      { linha: "LIFTKAP", motivo: "Item que a administradora recompra para cada prédio da carteira." },
      { linha: "PISO_TATIL", motivo: "Adequação de acessibilidade dos prédios administrados." },
      { linha: "VINIL", motivo: "Capacho personalizado por condomínio." },
      { linha: "FIREKAP", motivo: "Sinalização de segurança em toda a carteira." },
      { linha: "DUO_OPERA", motivo: "Entrada do próprio escritório." },
    ],
  },
  {
    id: "hotel",
    nome: "Hotéis e pousadas",
    descricao: "Hotéis, resorts, pousadas e apart-hotéis.",
    prioridade: 3,
    regras: [
      { chave: "tourism", valores: ["hotel", "motel", "guest_house", "hostel", "apartment", "resort", "chalet"] },
    ],
    produtos: [
      { linha: "VINIL", motivo: "Capacho com a marca do hotel na entrada principal." },
      { linha: "CLEANKAP", motivo: "Recepção e lobby com tapete impresso de alto padrão." },
      { linha: "DUO_OPERA", motivo: "Corredores e salas de evento com acabamento premium." },
      { linha: "LIFTKAP", motivo: "Proteção do elevador em obras, eventos e troca de mobília." },
      { linha: "W_KAP", motivo: "Área de piscina e vestiário sem escorregão." },
      { linha: "DECK_MODULAR", motivo: "Deck da piscina e varandas." },
      { linha: "GRAMA_DECORATIVA", motivo: "Áreas de convivência e fachada sempre verdes." },
      { linha: "PISO_TATIL", motivo: "Acessibilidade exigida em estabelecimento aberto ao público." },
      { linha: "ITALY_ELEGANCE", motivo: "Suítes e lounges com tapete decorativo." },
    ],
  },
  {
    id: "academia",
    nome: "Academias e estúdios",
    descricao: "Academias, crossfit, pilates, estúdios de yoga e centros esportivos.",
    prioridade: 3,
    regras: [
      { chave: "leisure", valores: ["fitness_centre", "sports_centre", "sports_hall", "dance"] },
      { chave: "sport", valores: ["fitness", "yoga", "martial_arts", "crossfit"] },
    ],
    produtos: [
      { linha: "RUBBERKAP", motivo: "Piso emborrachado é o carro-chefe da área de peso livre." },
      { linha: "LAMINADO", motivo: "Rolo resistente para a sala de musculação e circulação." },
      { linha: "S_KAP", motivo: "Vestiário e área do chuveiro sem risco de queda." },
      { linha: "YOGAKAP", motivo: "Tapetes para as aulas de yoga, pilates e alongamento." },
      { linha: "VINIL", motivo: "Capacho com a logo da academia na entrada." },
      { linha: "FITA_DEMARCACAO", motivo: "Demarcação de baias de treino e áreas de circulação." },
    ],
  },
  {
    id: "saude",
    nome: "Clínicas, hospitais e consultórios",
    descricao: "Clínicas médicas e odontológicas, hospitais, laboratórios e veterinárias.",
    prioridade: 2,
    regras: [
      { chave: "amenity", valores: ["clinic", "doctors", "hospital", "dentist", "veterinary", "pharmacy"] },
      { chave: "healthcare" },
    ],
    produtos: [
      { linha: "DUO_OPERA", motivo: "Recepção com acabamento premium e fácil limpeza." },
      { linha: "CLEANKAP", motivo: "Tapete de entrada personalizado com a marca da clínica." },
      { linha: "PISO_TATIL", motivo: "Acessibilidade obrigatória no atendimento ao público." },
      { linha: "PROTEPISO", motivo: "Protege o piso das cadeiras de rodinha dos consultórios." },
      { linha: "ANTIFADIGA", motivo: "Recepção e laboratório onde a equipe fica horas em pé." },
      { linha: "RUBBERKAP", motivo: "Sala de fisioterapia e reabilitação." },
    ],
  },
  {
    id: "educacao",
    nome: "Escolas e creches",
    descricao: "Escolas, creches, faculdades e cursos.",
    prioridade: 2,
    regras: [
      { chave: "amenity", valores: ["school", "kindergarten", "college", "university", "childcare"] },
    ],
    produtos: [
      { linha: "PLAYKAP", motivo: "Piso modular colorido e seguro no parquinho." },
      { linha: "GRAMA_ESPORTIVA", motivo: "Quadra e campo de futebol da escola." },
      { linha: "GRAMA_DECORATIVA", motivo: "Pátio e áreas de recreação sem lama." },
      { linha: "PISO_TATIL", motivo: "Acessibilidade obrigatória em prédio escolar." },
      { linha: "VINIL", motivo: "Capacho personalizado com a marca da escola." },
      { linha: "FITA_DEMARCACAO", motivo: "Demarcação de filas, quadras e rotas de fuga." },
    ],
  },
  {
    id: "alimentacao",
    nome: "Restaurantes, bares e padarias",
    descricao: "Restaurantes, lanchonetes, cafés, bares, padarias e cozinhas industriais.",
    prioridade: 2,
    regras: [
      { chave: "amenity", valores: ["restaurant", "fast_food", "cafe", "bar", "pub", "food_court", "ice_cream"] },
      { chave: "shop", valores: ["bakery", "butcher", "deli"] },
    ],
    produtos: [
      { linha: "ANTIFADIGA", motivo: "Cozinha e balcão: a equipe passa o turno inteiro em pé." },
      { linha: "ACQUAKAP", motivo: "Piso modular para a área molhada da cozinha." },
      { linha: "H_KAP", motivo: "Antiderrapante onde cai água e gordura." },
      { linha: "VINIL", motivo: "Capacho com a marca na entrada do salão." },
      { linha: "FIREKAP", motivo: "Sinalização de extintor exigida na vistoria do bombeiro." },
      { linha: "DECK_MODULAR", motivo: "Área externa e deck de mesas." },
    ],
  },
  {
    id: "varejo",
    nome: "Lojas, shoppings e supermercados",
    descricao: "Comércio de rua, galerias, shoppings, mercados e franquias.",
    prioridade: 2,
    regras: [
      { chave: "shop", valores: ["supermarket", "convenience", "mall", "department_store", "clothes", "shoes", "furniture", "hardware", "jewelry", "optician", "sports"] },
      { chave: "amenity", valores: ["marketplace"] },
    ],
    produtos: [
      { linha: "VINIL", motivo: "Capacho personalizado é vitrine da marca na porta." },
      { linha: "CONECTADO", motivo: "Porta de acesso de grande circulação, padrão de shopping." },
      { linha: "WATERKAP", motivo: "Segura a água na entrada em dia de chuva." },
      { linha: "SUPERIOR", motivo: "Piso modular para portarias e entradas amplas." },
      { linha: "ANTIFADIGA", motivo: "Caixa, açougue e balcão onde se trabalha em pé." },
      { linha: "WIND_BANNER", motivo: "Bandeira de promoção na fachada." },
      { linha: "PISO_TATIL", motivo: "Acessibilidade obrigatória no comércio." },
    ],
  },
  {
    id: "beleza",
    nome: "Salões e barbearias",
    descricao: "Salões de beleza, barbearias, estúdios de estética e tatuagem.",
    prioridade: 2,
    regras: [
      { chave: "shop", valores: ["hairdresser", "beauty", "tattoo", "massage"] },
    ],
    produtos: [
      { linha: "BARBERKAP", motivo: "Tapete antifadiga feito para a cadeira do salão." },
      { linha: "VINIL", motivo: "Capacho com a logo do salão na entrada." },
      { linha: "ANTIFADIGA", motivo: "Profissional em pé o dia inteiro atrás da cadeira." },
      { linha: "ITALY_ELEGANCE", motivo: "Espera e recepção com tapete decorativo." },
    ],
  },
  {
    id: "automotivo",
    nome: "Concessionárias, oficinas e lava-rápidos",
    descricao: "Venda de veículos, oficinas, autopeças, lava-rápidos e locadoras.",
    prioridade: 3,
    regras: [
      { chave: "shop", valores: ["car", "car_repair", "car_parts", "motorcycle", "tyres"] },
      { chave: "amenity", valores: ["car_wash", "car_rental", "fuel"] },
    ],
    produtos: [
      { linha: "AUTOMOTIVO", motivo: "Tapete automotivo personalizado para venda e entrega de veículos." },
      { linha: "VINIL", motivo: "Capacho com a marca da concessionária no showroom." },
      { linha: "TERRA", motivo: "Barreira contra barro e graxa na entrada da oficina." },
      { linha: "LAMINADO", motivo: "Piso em rolo para a área de serviço e box de lavagem." },
      { linha: "ANTIFADIGA", motivo: "Bancada e box onde o mecânico fica em pé." },
      { linha: "WIND_BANNER", motivo: "Bandeira de campanha na frente da loja." },
    ],
  },
  {
    id: "industria",
    nome: "Indústrias, galpões e construtoras",
    descricao: "Fábricas, distribuidoras, transportadoras, obras e construtoras.",
    prioridade: 3,
    regras: [
      { chave: "building", valores: ["industrial", "warehouse"] },
      { chave: "industrial" },
      { chave: "man_made", valores: ["works"] },
      { chave: "office", valores: ["company", "construction", "logistics"] },
    ],
    produtos: [
      { linha: "ANTIFADIGA", motivo: "Exigência de ergonomia da NR-17 para trabalho em pé." },
      { linha: "TERRA", motivo: "Retém sujeira pesada na entrada do galpão." },
      { linha: "LAMINADO", motivo: "Piso em rolo para corredores e áreas de produção." },
      { linha: "FITA_DEMARCACAO", motivo: "Demarcação de rotas, empilhadeira e áreas de risco." },
      { linha: "FIREKAP", motivo: "Sinalização de extintores e hidrantes." },
      { linha: "S_KAP", motivo: "Antiderrapante em áreas molhadas e refeitório." },
      { linha: "PISO_TATIL", motivo: "Acessibilidade na área administrativa." },
    ],
  },
  {
    id: "escritorio",
    nome: "Escritórios, bancos e coworkings",
    descricao: "Escritórios, contabilidades, bancos, cartórios e coworkings.",
    prioridade: 2,
    regras: [
      { chave: "office", valores: ["company", "lawyer", "accountant", "insurance", "government", "coworking", "it", "advertising_agency"] },
      { chave: "amenity", valores: ["bank", "coworking_space"] },
    ],
    produtos: [
      { linha: "DUO_OPERA", motivo: "Recepção e corredores com acabamento premium." },
      { linha: "PROTEPISO", motivo: "Cada estação de trabalho com cadeira de rodinha precisa de um." },
      { linha: "CLEANKAP", motivo: "Tapete de entrada com a marca da empresa." },
      { linha: "ITALY_ELEGANCE", motivo: "Sala de reunião e diretoria." },
      { linha: "FITA_DEMARCACAO", motivo: "Organização de filas de atendimento." },
      { linha: "PISO_TATIL", motivo: "Acessibilidade no atendimento ao público." },
    ],
  },
  {
    id: "publico",
    nome: "Órgãos públicos e postos de saúde",
    descricao: "Prefeituras, câmaras, postos de saúde, correios e assistência social.",
    prioridade: 2,
    regras: [
      { chave: "amenity", valores: ["townhall", "courthouse", "police", "fire_station", "post_office", "social_facility", "community_centre", "library"] },
      { chave: "office", valores: ["government"] },
    ],
    produtos: [
      { linha: "PISO_TATIL", motivo: "Acessibilidade é exigência legal em prédio público." },
      { linha: "FITA_ANTIDERRAPANTE", motivo: "Escadas e rampas de acesso." },
      { linha: "DUO_OPERA", motivo: "Atendimento ao público com tapete de alta durabilidade." },
      { linha: "VINIL", motivo: "Capacho com o brasão do órgão." },
      { linha: "FIREKAP", motivo: "Sinalização de combate a incêndio." },
      { linha: "FITA_DEMARCACAO", motivo: "Filas e organização do atendimento." },
    ],
  },
  {
    id: "religioso",
    nome: "Igrejas e salões de eventos",
    descricao: "Igrejas, templos, centros de eventos e salões de festa.",
    prioridade: 1,
    regras: [
      { chave: "amenity", valores: ["place_of_worship", "events_venue", "conference_centre"] },
    ],
    produtos: [
      { linha: "DUO_OPERA", motivo: "Corredor central e entrada de grande circulação." },
      { linha: "VINIL", motivo: "Capacho personalizado na entrada." },
      { linha: "PISO_TATIL", motivo: "Acessibilidade em local de reunião pública." },
      { linha: "FIREKAP", motivo: "Sinalização de extintores para o alvará." },
    ],
  },
  {
    id: "lazer",
    nome: "Clubes, quadras e playgrounds",
    descricao: "Clubes, quadras poliesportivas, campos, playgrounds e parques.",
    prioridade: 2,
    regras: [
      { chave: "leisure", valores: ["playground", "pitch", "stadium", "park", "water_park", "swimming_pool", "club"] },
    ],
    produtos: [
      { linha: "PLAYKAP", motivo: "Piso modular de encaixe no playground." },
      { linha: "GRAMA_ESPORTIVA", motivo: "Campo e quadra com grama de 50mm." },
      { linha: "GRAMA_DECORATIVA", motivo: "Área de convivência e arquibancada." },
      { linha: "RUBBERKAP", motivo: "Piso de impacto para academia ao ar livre e tatame." },
      { linha: "H_KAP", motivo: "Borda de piscina e vestiário antiderrapante." },
      { linha: "DECK_MODULAR", motivo: "Deck da piscina e área de descanso." },
    ],
  },
  {
    id: "pet",
    nome: "Pet shops e clínicas veterinárias",
    descricao: "Pet shops, banho e tosa e clínicas veterinárias.",
    prioridade: 1,
    regras: [
      { chave: "shop", valores: ["pet", "pet_grooming"] },
    ],
    produtos: [
      { linha: "W_KAP", motivo: "Banho e tosa é área molhada o dia inteiro." },
      { linha: "ANTIFADIGA", motivo: "Tosador trabalha horas em pé na bancada." },
      { linha: "VINIL", motivo: "Capacho personalizado na entrada da loja." },
      { linha: "GRAMA_DECORATIVA", motivo: "Área de recreação dos animais." },
    ],
  },
];

export const SEGMENTOS_POR_ID = new Map(SEGMENTOS.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------
// Busca no OpenStreetMap
// ---------------------------------------------------------------------------

export interface Lead {
  /** "node/123456" — identidade do lugar no OpenStreetMap. */
  id: string;
  nome: string;
  segmentoId: string;
  /** Só vem quando o mapa tem a etiqueta de CNPJ (raro). */
  cnpj: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  /** Todos os telefones achados no mapa (fixo, celular, WhatsApp). */
  telefones: string[];
  emails: string[];
  site: string;
  mapa: string;
  /** Quanto mais completo e mais promissor o segmento, maior a nota. */
  nota: number;
  /** Já existe um cadastro com esse nome. */
  jaCadastrado: boolean;
}

export interface ElementoOsm {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function filtroOverpass(regra: RegraOsm): string {
  if (!regra.valores?.length) return `["${regra.chave}"]["name"]`;
  return `["${regra.chave}"~"^(${regra.valores.join("|")})$"]["name"]`;
}

/** Monta a consulta Overpass para os segmentos escolhidos dentro de uma área. */
/**
 * Aceita o nome da cidade digitado sem acento: cada vogal vira um grupo com
 * as formas acentuadas ("Sao Paulo" acha "São Paulo").
 */
function regexCidade(cidade: string): string {
  const grupos: Record<string, string> = {
    a: "[aáàâã]",
    e: "[eéèê]",
    i: "[iíî]",
    o: "[oóòôõ]",
    u: "[uúü]",
    c: "[cç]",
  };

  return cidade
    .trim()
    .replace(/["\\]/g, "")
    .split("")
    .map((letra) => grupos[letra.toLowerCase()] ?? letra)
    .join("");
}

/**
 * Monta a consulta Overpass: primeiro acha a área da cidade (dentro do estado,
 * para não confundir cidades de mesmo nome) e depois busca os segmentos nela.
 */
export function montarConsulta(
  cidade: string,
  estado: string,
  segmentosIds: string[],
  limite: number,
): string {
  const filtros = segmentosIds
    .flatMap((id) => SEGMENTOS_POR_ID.get(id)?.regras ?? [])
    .map((regra) => `  nwr${filtroOverpass(regra)}(area.a);`)
    .join("\n");

  const uf = estado.trim().toUpperCase();
  const areaEstado = /^[A-Z]{2}$/.test(uf)
    ? `area["ISO3166-2"="BR-${uf}"]["admin_level"="4"]->.uf;`
    : `area["ISO3166-1"="BR"]["admin_level"="2"]->.uf;`;

  return `[out:json][timeout:60];
${areaEstado}
rel["name"~"^${regexCidade(cidade)}$",i]["boundary"="administrative"]["admin_level"="8"](area.uf);
map_to_area->.a;
(
${filtros}
);
out center ${limite};`;
}

/** Descobre a que segmento escolhido um lugar pertence (o primeiro que casar). */
function segmentoDoElemento(tags: Record<string, string>, segmentosIds: string[]): Segmento | null {
  for (const id of segmentosIds) {
    const segmento = SEGMENTOS_POR_ID.get(id);
    if (!segmento) continue;
    for (const regra of segmento.regras) {
      const valor = tags[regra.chave];
      if (!valor) continue;
      if (!regra.valores?.length || regra.valores.includes(valor)) return segmento;
    }
  }
  return null;
}

function primeiro(tags: Record<string, string>, chaves: string[]): string {
  for (const chave of chaves) {
    // O mapa às vezes guarda vários valores separados por ponto e vírgula.
    const valor = tags[chave]?.split(";")[0]?.trim();
    if (valor) return valor;
  }
  return "";
}

/** Junta todos os valores dessas etiquetas, separando os que vêm em lista. */
function todos(tags: Record<string, string>, chaves: string[]): string[] {
  const achados: string[] = [];
  for (const chave of chaves) {
    for (const parte of (tags[chave] ?? "").split(/[;,]/)) {
      const valor = parte.trim();
      if (valor) achados.push(valor);
    }
  }
  return achados;
}

/** Etiquetas de telefone usadas no OpenStreetMap, da mais para a menos comum. */
const TAGS_TELEFONE = [
  "contact:phone",
  "phone",
  "contact:mobile",
  "mobile",
  "contact:whatsapp",
  "whatsapp",
  "phone:mobile",
  "contact:phone:mobile",
  "fax",
  "contact:fax",
];

const TAGS_EMAIL = ["contact:email", "email", "contact:email:office"];

/** Telefones sem repetição: compara só os dígitos, mas mostra formatado. */
function lerTelefones(tags: Record<string, string>): string[] {
  const vistos = new Set<string>();
  const lista: string[] = [];

  for (const bruto of todos(tags, TAGS_TELEFONE)) {
    const digitos = bruto.replace(/\D/g, "");
    if (digitos.length < 8) continue;
    // Um mesmo número aparece com e sem o código do país.
    const chave = digitos.replace(/^55/, "");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    lista.push(bruto);
  }

  return lista;
}

function lerEmails(tags: Record<string, string>): string[] {
  const vistos = new Set<string>();
  const lista: string[] = [];

  for (const bruto of todos(tags, TAGS_EMAIL)) {
    const email = emailValido(bruto);
    if (!email || vistos.has(email)) continue;
    vistos.add(email);
    lista.push(email);
  }

  return lista;
}

/** Endereço em uma linha só, do jeito que aparece no cartão do lead. */
export function enderecoCompleto(lead: Lead): string {
  const rua = [lead.endereco, lead.numero].filter(Boolean).join(", ");
  const local = [lead.bairro, lead.cidade].filter(Boolean).join(" - ");
  return [rua, local].filter(Boolean).join(" · ");
}

/**
 * O CNPJ, quando existe no mapa, vem como "BR12345678000199" (ref:vatin) ou
 * só com os dígitos. Devolve formatado ou vazio.
 */
function lerCnpj(tags: Record<string, string>): string {
  const bruto = primeiro(tags, ["ref:vatin", "cnpj", "ref:CNPJ"]);
  const digitos = bruto.replace(/\D/g, "");
  return digitos.length === 14 ? formatarCpfCnpj(digitos) : "";
}

/** E-mail do mapa às vezes vem quebrado; só aproveita o que parece válido. */
function emailValido(valor: string): string {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor) ? valor.toLowerCase() : "";
}

/** Nome só de números ou muito curto costuma ser ruído do mapa. */
function nomeUtil(nome: string): boolean {
  return nome.trim().length >= 3 && /\p{L}{3}/u.test(nome);
}

export interface ConversaoOpcoes {
  segmentosIds: string[];
  /** Cidade e estado pesquisados, usados quando o mapa não traz o endereço. */
  cidade: string;
  estado: string;
  /** Nomes já cadastrados, em caixa alta e sem acento, para marcar repetidos. */
  nomesCadastrados: Set<string>;
}

export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Transforma a resposta do Overpass em leads prontos para a tela. */
export function converterElementos(elementos: ElementoOsm[], opcoes: ConversaoOpcoes): Lead[] {
  const vistos = new Set<string>();
  const leads: Lead[] = [];

  for (const el of elementos) {
    const tags = el.tags ?? {};
    const nome = tags.name?.trim() ?? "";
    if (!nomeUtil(nome)) continue;

    const segmento = segmentoDoElemento(tags, opcoes.segmentosIds);
    if (!segmento) continue;

    const chave = `${segmento.id}|${normalizarNome(nome)}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const endereco = primeiro(tags, ["addr:street"]);
    const telefones = lerTelefones(tags);
    const emails = lerEmails(tags);
    const site = primeiro(tags, ["contact:website", "website", "url"]);

    const nota =
      segmento.prioridade * 2 +
      (telefones.length > 0 ? 3 : 0) +
      (endereco ? 2 : 0) +
      (site ? 1 : 0) +
      (emails.length > 0 ? 1 : 0);

    leads.push({
      id: `${el.type}/${el.id}`,
      nome,
      segmentoId: segmento.id,
      cnpj: lerCnpj(tags),
      endereco,
      numero: primeiro(tags, ["addr:housenumber"]),
      bairro: primeiro(tags, [
        "addr:suburb",
        "addr:neighbourhood",
        "addr:quarter",
        "addr:district",
        "addr:place",
      ]),
      cidade: primeiro(tags, ["addr:city"]) || opcoes.cidade,
      estado: primeiro(tags, ["addr:state"]) || opcoes.estado,
      telefones,
      emails,
      site,
      mapa: lat && lon ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}` : "",
      nota,
      jaCadastrado: opcoes.nomesCadastrados.has(normalizarNome(nome)),
    });
  }

  return leads.sort((a, b) => b.nota - a.nota || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Texto para salvar o contato no WhatsApp: nome - CNPJ - cidade. */
export function textoParaContato(lead: Lead): string {
  return [lead.nome, lead.cnpj, lead.cidade].filter(Boolean).join(" - ");
}

// ---------------------------------------------------------------------------
// Apresentação comercial
// ---------------------------------------------------------------------------

/**
 * Descobre a qual linha um produto cadastrado pertence, olhando o nome. Assim
 * a apresentação sai com as fotos dos produtos que já estão no sistema.
 */
export function linhaDoProduto(nomeProduto: string): ChaveLinha | null {
  const nome = normalizarNome(nomeProduto);

  const candidatos = Object.entries(LINHAS).flatMap(([chave, linha]) =>
    (linha.termos ?? [chave.replace(/_/g, " ")]).map((termo) => ({
      chave: chave as ChaveLinha,
      termo: normalizarNome(termo),
    })),
  );

  // Do termo mais longo para o mais curto, senão "DUO" venceria "DUO OPERA".
  candidatos.sort((a, b) => b.termo.length - a.termo.length);

  return candidatos.find(({ termo }) => nome.includes(termo))?.chave ?? null;
}

export interface DadosEmpresa {
  nome: string;
  telefone: string;
  site: string;
}

/** Mensagem pronta para colar no WhatsApp, com os argumentos do segmento. */
export function montarApresentacao(lead: Lead, empresa: DadosEmpresa, linhas: ChaveLinha[]): string {
  const segmento = SEGMENTOS_POR_ID.get(lead.segmentoId);
  const escolhidas = linhas.length > 0 ? linhas : (segmento?.produtos ?? []).slice(0, 5).map((p) => p.linha);

  const motivos = new Map((segmento?.produtos ?? []).map((p) => [p.linha, p.motivo]));
  const itens = escolhidas
    .map((linha) => {
      const motivo = motivos.get(linha);
      return `• ${LINHAS[linha].nome}${motivo ? ` — ${motivo.toLowerCase()}` : ""}`;
    })
    .join("\n");

  const partes = [
    `Olá! Falo da ${empresa.nome || "nossa empresa"}, distribuidora autorizada Kapazi.`,
    "",
    `Separei o que mais faz diferença para ${(segmento?.nome ?? "empresas como a sua").toLowerCase()} como ${lead.nome}:`,
    "",
    itens,
    "",
    "Tudo pode ser personalizado com a marca de vocês, com garantia de fábrica e entrega para a região.",
    "",
    "Posso enviar as fotos e os valores?",
  ];

  const assinatura = [empresa.telefone, empresa.site].filter(Boolean).join(" · ");
  if (assinatura) partes.push("", assinatura);

  return partes.join("\n");
}

/** Só os dígitos, no formato que o WhatsApp aceita (55 + DDD + número). */
export function linkWhatsapp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10) return "";
  const comPais = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${comPais}`;
}
