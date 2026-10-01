"use client";

import { useMemo, useState, useTransition } from "react";
import {
  BuildingIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  IdCardIcon,
  Loader2,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  SearchIcon,
  UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { salvarLeadComoCadastro } from "@/server/leads";
import { ApresentacaoDialog, type ProdutoFoto } from "@/components/leads/apresentacao-dialog";
import {
  LINHAS,
  SEGMENTOS,
  SEGMENTOS_POR_ID,
  converterElementos,
  enderecoCompleto,
  linkWhatsapp,
  montarConsulta,
  textoParaContato,
  type DadosEmpresa,
  type ElementoOsm,
  type Lead,
} from "@/lib/leads";

/**
 * Servidores públicos do Overpass. São gratuitos e às vezes ficam
 * congestionados, então a busca tenta um de cada vez até um responder.
 */
const SERVIDORES_OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/** Tempo máximo por servidor antes de passar para o próximo. */
const LIMITE_ESPERA_MS = 30_000;

const LIMITE_RESULTADOS = 400;

interface Props {
  cidadesSugeridas: { cidade: string; estado: string; quantos: number }[];
  nomesCadastrados: string[];
  produtosComFoto: ProdutoFoto[];
  empresa: DadosEmpresa;
}

/** Filtro de contato: o que precisa ter para o lead aparecer na lista. */
const FILTROS_CONTATO = [
  { id: "todos", rotulo: "Todos" },
  { id: "telefone", rotulo: "Apenas com telefone" },
  { id: "telefone-email", rotulo: "Apenas com telefone e e-mail" },
] as const;

type FiltroContato = (typeof FILTROS_CONTATO)[number]["id"];

function passaNoFiltro(lead: Lead, filtro: FiltroContato): boolean {
  if (filtro === "telefone") return lead.telefones.length > 0;
  if (filtro === "telefone-email") return lead.telefones.length > 0 && lead.emails.length > 0;
  return true;
}

async function consultarOverpass(consulta: string): Promise<{ elements: unknown[] }> {
  let ultimoErro: unknown;

  for (const servidor of SERVIDORES_OVERPASS) {
    try {
      const resposta = await fetch(servidor, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: consulta,
        signal: AbortSignal.timeout(LIMITE_ESPERA_MS),
      });
      if (!resposta.ok) throw new Error(`Servidor de mapas respondeu ${resposta.status}.`);
      return (await resposta.json()) as { elements: unknown[] };
    } catch (erro) {
      ultimoErro = erro;
    }
  }

  console.error("Overpass falhou em todos os servidores:", ultimoErro);
  throw new Error(
    "Os servidores públicos de mapa estão congestionados agora. Tente de novo em alguns minutos.",
  );
}

/**
 * Copia para a área de transferência. Tenta o jeito moderno e, se o navegador
 * recusar (acontece fora de HTTPS e em alguns celulares), cai no jeito antigo.
 */
async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = texto;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copiou = document.execCommand("copy");
      area.remove();
      return copiou;
    } catch {
      return false;
    }
  }
}

function CartaoLead({
  lead,
  produtosComFoto,
  empresa,
  onCadastrado,
}: {
  lead: Lead;
  produtosComFoto: ProdutoFoto[];
  empresa: DadosEmpresa;
  onCadastrado: (id: string) => void;
}) {
  const [salvando, iniciarSalvamento] = useTransition();
  const [verTodos, setVerTodos] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const segmento = SEGMENTOS_POR_ID.get(lead.segmentoId);
  const produtos = segmento?.produtos ?? [];
  const visiveis = verTodos ? produtos : produtos.slice(0, 4);
  const endereco = enderecoCompleto(lead);

  async function copiarContato() {
    if (await copiarTexto(textoParaContato(lead))) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      return;
    }
    toast.error("O navegador não deixou copiar. Selecione o texto na tela.");
  }

  function cadastrar() {
    iniciarSalvamento(async () => {
      try {
        const { codigo } = await salvarLeadComoCadastro(
          lead,
          produtos.map((p) => p.linha),
        );
        toast.success(`${lead.nome} cadastrado com o código ${String(codigo).padStart(4, "0")}.`);
        onCadastrado(lead.id);
      } catch (erro) {
        toast.error(erro instanceof Error ? erro.message : "Não consegui cadastrar esse lead.");
      }
    });
  }

  return (
    <article className="superficie flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-base leading-tight font-semibold text-foreground">{lead.nome}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{segmento?.nome}</Badge>
            {lead.bairro && (
              <Badge variant="outline" className="font-normal">
                {lead.bairro}
              </Badge>
            )}
            {lead.jaCadastrado && (
              <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-400">
                já cadastrado
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={copiarContato} title={textoParaContato(lead)}>
            {copiado ? <CheckIcon className="size-4 text-emerald-600" /> : <CopyIcon className="size-4" />}
            {copiado ? "Copiado" : "Copiar nome"}
          </Button>

          <ApresentacaoDialog
            lead={lead}
            produtos={produtosComFoto}
            empresa={empresa}
            copiarTexto={copiarTexto}
          />

          <Button
            size="sm"
            variant={lead.jaCadastrado ? "outline" : "default"}
            onClick={cadastrar}
            disabled={salvando}
          >
            {salvando ? <Loader2 className="size-4 animate-spin" /> : <UserPlusIcon className="size-4" />}
            Cadastrar cliente
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <IdCardIcon className="size-3.5 shrink-0" />
          {lead.cnpj ? (
            <span className="font-mono text-foreground">{lead.cnpj}</span>
          ) : (
            <span className="italic">CNPJ não disponível nesta base</span>
          )}
        </p>

        {endereco ? (
          <p className="flex items-start gap-2">
            <MapPinIcon className="mt-0.5 size-3.5 shrink-0" />
            <span>{endereco}</span>
          </p>
        ) : (
          <p className="flex items-start gap-2">
            <MapPinIcon className="mt-0.5 size-3.5 shrink-0" />
            <span className="italic">Endereço não informado no mapa — veja a localização</span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {lead.telefones.map((telefone) => {
            const whatsapp = linkWhatsapp(telefone);
            return (
              <a
                key={telefone}
                className="flex items-center gap-1.5 hover:text-foreground"
                href={whatsapp || `tel:${telefone}`}
                target="_blank"
                rel="noreferrer"
                title={whatsapp ? "Abrir no WhatsApp" : "Ligar"}
              >
                <PhoneIcon className="size-3.5" /> {telefone}
              </a>
            );
          })}
          {lead.emails.map((email) => (
            <a
              key={email}
              className="flex items-center gap-1.5 hover:text-foreground"
              href={`mailto:${email}`}
            >
              <MailIcon className="size-3.5" /> {email}
            </a>
          ))}
          {lead.site && (
            <a className="flex items-center gap-1.5 hover:text-foreground" href={lead.site} target="_blank" rel="noreferrer">
              <ExternalLinkIcon className="size-3.5" /> site
            </a>
          )}
          {lead.mapa && (
            <a className="flex items-center gap-1.5 hover:text-foreground" href={lead.mapa} target="_blank" rel="noreferrer">
              <MapPinIcon className="size-3.5" /> ver no mapa
            </a>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-muted/50 p-3">
        <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          O que oferecer
        </p>
        <ul className="flex flex-col gap-1.5">
          {visiveis.map(({ linha, motivo }) => (
            <li key={linha} className="flex gap-2 text-sm">
              <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span>
                <span className="font-medium text-foreground">{LINHAS[linha].nome}</span>
                <span className="text-muted-foreground"> — {motivo}</span>
              </span>
            </li>
          ))}
        </ul>
        {produtos.length > 4 && (
          <button
            type="button"
            onClick={() => setVerTodos((v) => !v)}
            className="mt-2 text-xs font-semibold text-primary hover:underline"
          >
            {verTodos ? "ver menos" : `ver mais ${produtos.length - 4}`}
          </button>
        )}
      </div>
    </article>
  );
}

export function BuscaLeads({ cidadesSugeridas, nomesCadastrados, produtosComFoto, empresa }: Props) {
  const principal = cidadesSugeridas[0];
  const [cidade, setCidade] = useState(principal?.cidade ?? "");
  const [estado, setEstado] = useState(principal?.estado ?? "");
  const [selecionados, setSelecionados] = useState<string[]>(["condominio", "hotel", "academia"]);
  const [buscando, setBuscando] = useState(false);
  const [progresso, setProgresso] = useState<{ nome: string; atual: number } | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [esconderClientes, setEsconderClientes] = useState(true);
  const [filtroContato, setFiltroContato] = useState<FiltroContato>("todos");
  const [cadastradosAgora, setCadastradosAgora] = useState<string[]>([]);

  const nomes = useMemo(() => new Set(nomesCadastrados), [nomesCadastrados]);

  const visiveis = useMemo(() => {
    if (!leads) return [];
    const salvos = new Set(cadastradosAgora);
    return leads
      .map((lead) => ({ ...lead, jaCadastrado: lead.jaCadastrado || salvos.has(lead.id) }))
      .filter((lead) => !esconderClientes || !lead.jaCadastrado)
      .filter((lead) => passaNoFiltro(lead, filtroContato));
  }, [leads, esconderClientes, filtroContato, cadastradosAgora]);

  /** Quantos leads cada filtro de contato traria, para mostrar no botão. */
  const contagens = useMemo(() => {
    const base = (leads ?? []).filter((lead) => !esconderClientes || !lead.jaCadastrado);
    return {
      todos: base.length,
      telefone: base.filter((l) => passaNoFiltro(l, "telefone")).length,
      "telefone-email": base.filter((l) => passaNoFiltro(l, "telefone-email")).length,
    } as Record<FiltroContato, number>;
  }, [leads, esconderClientes]);

  function alternarSegmento(id: string) {
    setSelecionados((atuais) =>
      atuais.includes(id) ? atuais.filter((s) => s !== id) : [...atuais, id],
    );
  }

  async function buscar() {
    if (!cidade.trim()) {
      toast.error("Informe a cidade onde quer prospectar.");
      return;
    }
    if (selecionados.length === 0) {
      toast.error("Escolha ao menos um segmento.");
      return;
    }

    setBuscando(true);
    setLeads(null);
    setCadastradosAgora([]);

    // Um segmento por vez: consulta grande é recusada pelos servidores
    // públicos, e assim um segmento que falha não derruba a busca inteira.
    const elementos: ElementoOsm[] = [];
    const falharam: string[] = [];

    for (const [indice, id] of selecionados.entries()) {
      setProgresso({ nome: SEGMENTOS_POR_ID.get(id)?.nome ?? "", atual: indice + 1 });
      try {
        const dados = await consultarOverpass(montarConsulta(cidade, estado, [id], LIMITE_RESULTADOS));
        elementos.push(...(dados.elements as ElementoOsm[]));
      } catch {
        falharam.push(SEGMENTOS_POR_ID.get(id)?.nome ?? id);
      }
    }

    setProgresso(null);
    setBuscando(false);

    if (falharam.length === selecionados.length) {
      toast.error("Os servidores públicos de mapa estão congestionados. Tente de novo em alguns minutos.");
      return;
    }

    const encontrados = converterElementos(elementos, {
      segmentosIds: selecionados,
      cidade: cidade.trim().toUpperCase(),
      estado: estado.trim().toUpperCase(),
      nomesCadastrados: nomes,
    });

    setLeads(encontrados);

    if (falharam.length > 0) {
      toast.warning(`Não deu para buscar: ${falharam.join(", ")}. Tente esses segmentos de novo.`);
    } else if (encontrados.length === 0) {
      toast.info("Nada encontrado. Confira o nome da cidade e o estado, ou marque outros segmentos.");
    }
  }

  const novos = visiveis.length;
  const repetidos = (leads?.length ?? 0) - novos;

  return (
    <div className="flex flex-col gap-5">
      <div className="superficie flex flex-col gap-4 p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_7rem_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cidade-lead">Cidade</Label>
            <Input
              id="cidade-lead"
              list="cidades-sugeridas"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Itapema"
            />
            <datalist id="cidades-sugeridas">
              {cidadesSugeridas.map((c) => (
                <option key={`${c.cidade}-${c.estado}`} value={c.cidade} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="estado-lead">Estado</Label>
            <Input
              id="estado-lead"
              value={estado}
              maxLength={2}
              onChange={(e) => setEstado(e.target.value.toUpperCase())}
              placeholder="SC"
            />
          </div>

          <Button onClick={buscar} disabled={buscando}>
            {buscando ? <Loader2 className="size-4 animate-spin" /> : <SearchIcon className="size-4" />}
            Buscar leads
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Segmentos</Label>
          <div className="flex flex-wrap gap-2">
            {SEGMENTOS.map((segmento) => {
              const ativo = selecionados.includes(segmento.id);
              return (
                <button
                  key={segmento.id}
                  type="button"
                  title={segmento.descricao}
                  onClick={() => alternarSegmento(segmento.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    ativo
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {segmento.nome}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {buscando && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {progresso
              ? `Procurando ${progresso.nome} (${progresso.atual} de ${selecionados.length})…`
              : "Procurando no mapa público do OpenStreetMap."}
          </p>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="esqueleto h-36 rounded-2xl" />
          ))}
        </div>
      )}

      {!buscando && leads !== null && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {FILTROS_CONTATO.map((filtro) => (
                <button
                  key={filtro.id}
                  type="button"
                  onClick={() => setFiltroContato(filtro.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    filtroContato === filtro.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {filtro.rotulo} ({contagens[filtro.id]})
                </button>
              ))}
            </div>

            {repetidos > 0 && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  checked={esconderClientes}
                  onChange={(e) => setEsconderClientes(e.target.checked)}
                />
                Esconder quem já está cadastrado ({repetidos})
              </label>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{novos}</span> lead
            {novos === 1 ? "" : "s"} para abordar
          </p>

          <div className="grid gap-3 xl:grid-cols-2">
            {visiveis.map((lead) => (
              <CartaoLead
                key={lead.id}
                lead={lead}
                produtosComFoto={produtosComFoto}
                empresa={empresa}
                onCadastrado={(id) => setCadastradosAgora((atuais) => [...atuais, id])}
              />
            ))}
          </div>
        </>
      )}

      {!buscando && leads === null && (
        <div className="superficie flex flex-col items-center gap-2 px-6 py-14 text-center">
          <BuildingIcon className="size-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            Escolha a cidade e os segmentos e clique em <strong>Buscar leads</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
