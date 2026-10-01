"use client";

import { useMemo, useState } from "react";
import { CheckIcon, CopyIcon, DownloadIcon, ImageIcon, Share2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  LINHAS,
  SEGMENTOS_POR_ID,
  linhaDoProduto,
  montarApresentacao,
  type ChaveLinha,
  type DadosEmpresa,
  type Lead,
} from "@/lib/leads";

export interface ProdutoFoto {
  id: string;
  nome: string;
  imagemUrl: string;
}

interface Props {
  lead: Lead;
  produtos: ProdutoFoto[];
  empresa: DadosEmpresa;
  copiarTexto: (texto: string) => Promise<boolean>;
}

async function baixarArquivo(url: string, nome: string) {
  const resposta = await fetch(url);
  const blob = await resposta.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = nome;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Busca as fotos escolhidas como arquivos, para o compartilhamento nativo. */
async function baixarComoArquivos(fotos: ProdutoFoto[]): Promise<File[]> {
  const arquivos: File[] = [];

  for (const foto of fotos) {
    try {
      const resposta = await fetch(foto.imagemUrl);
      const blob = await resposta.blob();
      const extensao = blob.type.split("/")[1] ?? "jpg";
      arquivos.push(new File([blob], `${foto.nome}.${extensao}`, { type: blob.type }));
    } catch {
      // Uma foto que não baixa não impede o envio das outras.
    }
  }

  return arquivos;
}

export function ApresentacaoDialog({ lead, produtos, empresa, copiarTexto }: Props) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const segmento = SEGMENTOS_POR_ID.get(lead.segmentoId);
  const linhasDoSegmento = useMemo(
    () => (segmento?.produtos ?? []).map((p) => p.linha),
    [segmento],
  );

  // Fotos dos produtos já cadastrados que servem para este segmento — uma por
  // linha, senão a apresentação vira quatro fotos quase iguais de vinil.
  const fotosDoSegmento = useMemo(() => {
    const posicao = new Map(linhasDoSegmento.map((linha, i) => [linha, i]));
    const porLinha = new Map<ChaveLinha, { produto: ProdutoFoto; linha: ChaveLinha }>();

    for (const produto of produtos) {
      const linha = linhaDoProduto(produto.nome);
      if (!linha || !posicao.has(linha) || porLinha.has(linha)) continue;
      porLinha.set(linha, { produto, linha });
    }

    return [...porLinha.values()].sort(
      (a, b) => (posicao.get(a.linha) ?? 99) - (posicao.get(b.linha) ?? 99),
    );
  }, [produtos, linhasDoSegmento]);

  // null = ainda não mexeu, então valem todas as fotos.
  const [escolhidas, setEscolhidas] = useState<string[] | null>(null);
  const selecionadas = fotosDoSegmento.filter(
    ({ produto }) => escolhidas === null || escolhidas.includes(produto.id),
  );

  // Se há foto, a mensagem fala dos produtos que o cliente vai ver.
  const linhasDaMensagem = useMemo(() => {
    const comFoto = selecionadas.map(({ linha }) => linha);
    const restantes = linhasDoSegmento.filter((linha) => !comFoto.includes(linha));
    return [...new Set([...comFoto, ...restantes])].slice(0, 6);
  }, [selecionadas, linhasDoSegmento]);

  const [mensagem, setMensagem] = useState("");
  const textoAtual = mensagem || montarApresentacao(lead, empresa, linhasDaMensagem);

  const podeCompartilhar = typeof navigator !== "undefined" && typeof navigator.share === "function";

  function alternarFoto(id: string) {
    setEscolhidas((atuais) => {
      const base = atuais ?? fotosDoSegmento.map((f) => f.produto.id);
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });
  }

  async function copiarMensagem() {
    if (await copiarTexto(textoAtual)) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      return;
    }
    toast.error("O navegador não deixou copiar. Selecione o texto e copie na mão.");
  }

  async function compartilhar() {
    setEnviando(true);
    try {
      const arquivos = await baixarComoArquivos(selecionadas.map((s) => s.produto));
      const comArquivos = arquivos.length > 0 && navigator.canShare?.({ files: arquivos });

      await navigator.share(
        comArquivos ? { text: textoAtual, files: arquivos } : { text: textoAtual },
      );
    } catch (erro) {
      // Fechar a janela de compartilhamento não é erro.
      if (erro instanceof Error && erro.name !== "AbortError") {
        toast.error("Não consegui abrir o compartilhamento. Use o botão de copiar.");
      }
    } finally {
      setEnviando(false);
    }
  }

  async function baixarFotos() {
    for (const { produto } of selecionadas) {
      try {
        await baixarArquivo(produto.imagemUrl, `${produto.nome}.jpg`);
      } catch {
        toast.error(`Não consegui baixar a foto de ${produto.nome}.`);
      }
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <ImageIcon className="size-4" />
            Apresentação
          </Button>
        }
      />

      <DialogContent className="max-h-[88vh] overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Apresentação para {lead.nome}</DialogTitle>
          <DialogDescription>
            Mensagem pronta para o WhatsApp com os produtos que fazem sentido para{" "}
            {(segmento?.nome ?? "esse cliente").toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`msg-${lead.id}`} className="text-sm font-medium">
              Mensagem
            </label>
            <Textarea
              id={`msg-${lead.id}`}
              rows={12}
              value={textoAtual}
              onChange={(e) => setMensagem(e.target.value)}
              className="font-mono text-xs leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              Dá para editar antes de enviar. Marque ou desmarque as fotos para mudar os produtos citados.
            </p>
          </div>

          {fotosDoSegmento.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                Fotos ({selecionadas.length} de {fotosDoSegmento.length} marcadas)
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {fotosDoSegmento.map(({ produto, linha }) => {
                  const marcada = selecionadas.some((s) => s.produto.id === produto.id);
                  return (
                    <button
                      key={produto.id}
                      type="button"
                      onClick={() => alternarFoto(produto.id)}
                      className={`relative overflow-hidden rounded-xl border-2 text-left transition-all ${
                        marcada ? "border-primary" : "border-transparent opacity-50 grayscale"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={produto.imagemUrl}
                        alt={produto.nome}
                        className="h-20 w-full object-cover"
                      />
                      {marcada && (
                        <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <CheckIcon className="size-3" />
                        </span>
                      )}
                      <span className="block truncate px-1.5 py-1 text-[10px] font-medium">
                        {LINHAS[linha].nome}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
              Nenhum produto cadastrado com foto se encaixa neste segmento. Cadastre os produtos com
              imagem em Produtos para que apareçam aqui.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {podeCompartilhar && (
              <Button onClick={compartilhar} disabled={enviando}>
                <Share2Icon className="size-4" />
                Enviar pelo WhatsApp
              </Button>
            )}
            <Button variant={podeCompartilhar ? "outline" : "default"} onClick={copiarMensagem}>
              {copiado ? <CheckIcon className="size-4 text-emerald-600" /> : <CopyIcon className="size-4" />}
              {copiado ? "Mensagem copiada" : "Copiar mensagem"}
            </Button>
            {selecionadas.length > 0 && (
              <Button variant="outline" onClick={baixarFotos}>
                <DownloadIcon className="size-4" />
                Baixar fotos
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
