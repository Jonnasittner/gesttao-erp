"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { DownloadIcon, ExternalLinkIcon, FileTextIcon, FilesIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SituacaoBadge } from "@/components/financeiro/situacao-badge";
import { ImagemZoom } from "@/components/ui/imagem-zoom";
import { detalharLancamento } from "@/server/financeiro";
import { formatarMoeda } from "@/lib/moeda";
import { formatarDataHoraSegundos, formatarDataISO, hojeISO } from "@/lib/datetime";
import { formatarCodigo } from "@/lib/codigo";
import { desembrulhar } from "@/lib/resultado";
import { baixarBoletosSeparados, urlBoleto } from "@/lib/boletos-download";
import { ROTULOS_CATEGORIA_CUSTO, ROTULOS_FORMA_PAGAMENTO } from "@/lib/rotulos";
import { rotuloClasse, rotuloDocumento } from "@/lib/financeiro";
import type { Cadastro, Lancamento, Pedido } from "@/lib/types";

const ROTULOS_STATUS_ASAAS: Record<string, string> = {
  PENDING: "Aguardando",
  OVERDUE: "Vencida",
  RECEIVED: "Recebida",
  CONFIRMED: "Confirmada",
  RECEIVED_IN_CASH: "Recebida fora do Asaas",
};

interface Detalhe {
  parcelas: Lancamento[];
  cliente: Cadastro | null;
  fornecedor: Cadastro | null;
  pedido: Pedido | null;
  /** Por parcela: como a saída aparece no extrato do Asaas ("Cartão de débito final 7762"). */
  pagamentosAsaas: Record<string, string>;
}

/**
 * Cliques em botões, links e campos da linha seguem sendo deles, sem abrir o
 * pop-up. Cliques em janelas abertas a partir da linha (portal, fora dela no
 * DOM, mas que o React propaga até aqui) também não contam.
 */
export function cliqueEmControle(e: React.MouseEvent) {
  const alvo = e.target as HTMLElement;
  if (!e.currentTarget.contains(alvo)) return true;
  return !!alvo.closest("a, button, input, select, textarea, label");
}

/**
 * Linha (tabela) ou cartão (celular) de um lançamento que, ao ser clicado,
 * abre o pop-up com todos os dados: a receber mostra cliente, pedido e
 * boletos; a pagar mostra o cupom, classe, pagamento e fornecedor.
 */
export function LancamentoClicavel({
  lancamentoId,
  tipo,
  como,
  className,
  children,
}: {
  lancamentoId: string;
  tipo: "RECEBER" | "PAGAR";
  como: "linha" | "cartao";
  className?: string;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [carregando, startTransition] = useTransition();

  function abrir(e: React.MouseEvent) {
    if (cliqueEmControle(e)) return;
    setAberto(true);
    setDetalhe(null);
    startTransition(async () => {
      try {
        setDetalhe(desembrulhar(await detalharLancamento(lancamentoId)));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao carregar a conta.");
        setAberto(false);
      }
    });
  }

  const props = { onClick: abrir, className: `cursor-pointer ${className ?? ""}`, title: "Ver detalhes" };

  return (
    <>
      {como === "linha" ? <TableRow {...props}>{children}</TableRow> : <div {...props}>{children}</div>}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {!detalhe ? (
            <>
              <DialogHeader>
                <DialogTitle>{tipo === "PAGAR" ? "Conta a pagar" : "Conta a receber"}</DialogTitle>
                <DialogDescription>Carregando…</DialogDescription>
              </DialogHeader>
              <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                {carregando && <Loader2Icon className="size-4 animate-spin" />} Buscando os dados do lançamento…
              </p>
            </>
          ) : tipo === "PAGAR" ? (
            <ConteudoContaPagar detalhe={detalhe} lancamentoId={lancamentoId} />
          ) : (
            <ConteudoDetalhe detalhe={detalhe} lancamentoId={lancamentoId} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ConteudoDetalhe({ detalhe, lancamentoId }: { detalhe: Detalhe; lancamentoId: string }) {
  const { parcelas, cliente, pedido } = detalhe;
  const primeira = parcelas[0];
  const hoje = hojeISO();
  const ordenadas = [...parcelas].sort((a, b) => a.parcela - b.parcela);
  const comBoleto = ordenadas.filter((p) => p.asaas?.linkBoleto);
  const total = ordenadas.reduce((soma, p) => soma + p.valor, 0);
  const recebido = ordenadas.filter((p) => p.status === "PAGO").reduce((soma, p) => soma + p.valor, 0);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{cliente?.nome ?? primeira.clienteNome}</DialogTitle>
        <DialogDescription>
          Documento {formatarCodigo(primeira.numeroDocumento)} · {ordenadas.length}{" "}
          {ordenadas.length === 1 ? "parcela" : "parcelas"} · {formatarMoeda(total)}
          {recebido > 0 && ` · recebido ${formatarMoeda(recebido)}`}
          {primeira.descricao && ` · ${primeira.descricao}`}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-5 text-sm">
        <SecaoCadastro titulo="Cliente" cadastro={cliente} nomeSalvo={primeira.clienteNome} />

        <SecaoPedido pedido={pedido} />

        {/* Parcelas e boletos */}
        <Secao titulo={ordenadas.length > 1 ? "Parcelas e boletos" : "Parcela e boleto"}>
          <ul className="flex flex-col divide-y rounded-lg border">
            {ordenadas.map((p) => (
              <li
                key={p.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 ${p.id === lancamentoId ? "bg-primary/5" : ""}`}
              >
                <span className="w-16 font-mono font-medium">
                  {p.parcela}/{p.totalParcelas}
                </span>
                <span className="w-28 tabular-nums">vence {formatarDataISO(p.vencimento)}</span>
                <span className="w-28 text-right font-semibold tabular-nums">{formatarMoeda(p.valor)}</span>
                <span className="flex items-center gap-1.5">
                  <SituacaoBadge lancamento={p} hoje={hoje} />
                  {p.status === "PAGO" && (
                    <span className="text-xs text-muted-foreground">
                      {p.pagoEm ? formatarDataHoraSegundos(p.pagoEm) : formatarDataISO(p.dataPagamento)}
                    </span>
                  )}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  {p.asaas ? (
                    <>
                      <Badge variant="outline">{ROTULOS_STATUS_ASAAS[p.asaas.status] ?? p.asaas.status}</Badge>
                      {p.asaas.linkBoleto && (
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={<a href={urlBoleto(p.id, p.parcela)} download />}
                          title="Baixar o boleto desta parcela"
                        >
                          <DownloadIcon /> Boleto
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        nativeButton={false}
                        aria-label="Abrir página de pagamento"
                        title="Abrir página de pagamento"
                        render={<a href={p.asaas.linkPagamento} target="_blank" rel="noreferrer" />}
                      >
                        <ExternalLinkIcon />
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {ROTULOS_FORMA_PAGAMENTO[p.formaPagamento] ?? "—"} · sem cobrança no Asaas
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Secao>
      </div>

      <DialogFooter className="items-center">
        <span className="mr-auto text-xs text-muted-foreground">
          {comBoleto.length === 0
            ? "Nenhuma parcela tem boleto gerado."
            : `${comBoleto.length} ${comBoleto.length === 1 ? "boleto" : "boletos"} no Asaas`}
        </span>
        {comBoleto.length > 1 && (
          <Button type="button" variant="outline" onClick={() => baixarBoletosSeparados(comBoleto)} className="gap-1.5">
            <FilesIcon /> Baixar separados
          </Button>
        )}
        {comBoleto.length > 0 && (
          <Button
            nativeButton={false}
            render={<a href={urlBoleto(lancamentoId)} download />}
            className="gap-1.5"
          >
            <DownloadIcon /> {comBoleto.length > 1 ? "Baixar todos juntos" : "Baixar boleto"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function SecaoCadastro({
  titulo,
  cadastro,
  nomeSalvo,
}: {
  titulo: string;
  cadastro: Cadastro | null;
  /** Nome gravado no lançamento, para quando o cadastro não existe mais. */
  nomeSalvo: string;
}) {
  return (
    <Secao
      titulo={titulo}
      acao={
        cadastro && (
          <Link href={`/cadastros/${cadastro.id}`} className="text-xs text-primary hover:underline">
            Abrir cadastro
          </Link>
        )
      }
    >
      {cadastro ? (
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Campo rotulo="Nome" valor={cadastro.nome} largo />
          <Campo rotulo="CPF/CNPJ" valor={cadastro.documento} />
          <Campo rotulo="Telefone" valor={cadastro.telefone} />
          <Campo rotulo="E-mail" valor={cadastro.email} />
          <Campo rotulo="Contato" valor={[cadastro.nomeContato, cadastro.observacaoContato].filter(Boolean).join(" · ")} />
          <Campo
            rotulo="Endereço"
            valor={[
              [cadastro.endereco, cadastro.numero].filter(Boolean).join(", "),
              cadastro.complemento,
              cadastro.bairro,
              [cadastro.cidade, cadastro.estado].filter(Boolean).join("/"),
            ]
              .filter(Boolean)
              .join(" · ")}
            largo
          />
        </dl>
      ) : (
        <p className="text-muted-foreground">{nomeSalvo || `${titulo} não encontrado.`}</p>
      )}
    </Secao>
  );
}

function SecaoPedido({ pedido }: { pedido: Pedido | null }) {
  return (
    <Secao
      titulo={pedido ? `${pedido.status === "PEDIDO" ? "Pedido" : "Orçamento"} ${formatarCodigo(pedido.numero)}` : "Pedido"}
      acao={
        pedido && (
          <Link href={`/pedidos/${pedido.id}`} className="text-xs text-primary hover:underline">
            Abrir pedido
          </Link>
        )
      }
    >
      {pedido ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Produto</th>
                <th className="px-3 py-2 text-right font-medium">Qtd.</th>
                <th className="px-3 py-2 text-right font-medium">Medidas</th>
                <th className="px-3 py-2 text-right font-medium">Unitário</th>
                <th className="px-3 py-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pedido.itens.map((item, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{item.produtoNome}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{item.quantidade.toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-muted-foreground">
                    {item.comprimento || item.largura
                      ? `${item.comprimento.toLocaleString("pt-BR")} × ${item.largura.toLocaleString("pt-BR")}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatarMoeda(item.precoUnitario)}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {formatarMoeda(item.quantidade * item.precoUnitario)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t">
                <td colSpan={4} className="px-3 py-2 text-right font-medium">
                  Total do pedido
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatarMoeda(pedido.total)}</td>
              </tr>
            </tfoot>
          </table>
          {pedido.observacao && <p className="border-t px-3 py-2 text-xs text-muted-foreground">{pedido.observacao}</p>}
        </div>
      ) : (
        <p className="text-muted-foreground">Este lançamento não está ligado a um pedido.</p>
      )}
    </Secao>
  );
}

function ConteudoContaPagar({ detalhe, lancamentoId }: { detalhe: Detalhe; lancamentoId: string }) {
  const { parcelas, cliente, fornecedor, pedido, pagamentosAsaas } = detalhe;
  const ordenadas = [...parcelas].sort((a, b) => a.parcela - b.parcela);
  const primeira = ordenadas.find((p) => p.id === lancamentoId) ?? ordenadas[0];
  const hoje = hojeISO();
  const total = ordenadas.reduce((soma, p) => soma + p.valor, 0);
  const pago = ordenadas.filter((p) => p.status === "PAGO").reduce((soma, p) => soma + p.valor, 0);
  const cupons = ordenadas.filter((p) => p.comprovanteUrl);
  const tipoCusto = primeira.categoria ? ROTULOS_CATEGORIA_CUSTO[primeira.categoria] : "";
  const nome = fornecedor?.nome || primeira.fornecedorNome || tipoCusto || "Conta a pagar";

  return (
    <>
      <DialogHeader>
        <DialogTitle>{nome}</DialogTitle>
        <DialogDescription>
          Documento {formatarCodigo(primeira.numeroDocumento)} · {ordenadas.length}{" "}
          {ordenadas.length === 1 ? "parcela" : "parcelas"} · {formatarMoeda(total)}
          {pago > 0 && ` · pago ${formatarMoeda(pago)}`}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-5 text-sm">
        {cupons.length > 0 && (
          <Secao titulo={cupons.length > 1 ? "Cupons" : "Cupom"}>
            <div className="flex flex-wrap gap-3">
              {cupons.map((p) => (
                <MiniaturaCupom
                  key={p.id}
                  url={p.comprovanteUrl}
                  legenda={cupons.length > 1 ? `Parcela ${p.parcela}` : undefined}
                />
              ))}
            </div>
          </Secao>
        )}

        <Secao titulo="Lançamento">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <Campo rotulo="Classe da despesa" valor={rotuloClasse(primeira.classeNome, primeira.subclasseNome)} />
            <Campo rotulo="Tipo de custo" valor={tipoCusto} />
            <Campo
              rotulo="Como foi pago"
              valor={
                pagamentosAsaas[primeira.id]
                  ? `${pagamentosAsaas[primeira.id]} · extrato do Asaas`
                  : ROTULOS_FORMA_PAGAMENTO[primeira.formaPagamento]
              }
            />
            <Campo rotulo="Pedido do fornecedor" valor={primeira.numeroPedidoFornecedor} />
            <Campo rotulo="Cliente" valor={cliente?.nome || primeira.clienteNome} />
            <Campo
              rotulo="Lançado por"
              valor={[primeira.usuarioNome, primeira.createdAt && formatarDataHoraSegundos(primeira.createdAt)]
                .filter(Boolean)
                .join(" em ")}
            />
            <Campo rotulo="Descrição" valor={primeira.descricao} largo />
          </dl>
        </Secao>

        <Secao titulo={ordenadas.length > 1 ? "Parcelas" : "Pagamento"}>
          <ul className="flex flex-col divide-y rounded-lg border">
            {ordenadas.map((p) => (
              <li
                key={p.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 ${p.id === lancamentoId ? "bg-primary/5" : ""}`}
              >
                <span className="w-20 font-mono font-medium">
                  {rotuloDocumento(p.numeroDocumento, p.parcela, p.totalParcelas)}
                </span>
                <span className="w-28 tabular-nums">vence {formatarDataISO(p.vencimento)}</span>
                <span className="w-28 text-right font-semibold tabular-nums">{formatarMoeda(p.valor)}</span>
                <span className="flex items-center gap-1.5">
                  <SituacaoBadge lancamento={p} hoje={hoje} />
                  {p.status === "PAGO" && (
                    <span className="text-xs text-muted-foreground">
                      {p.pagoEm ? formatarDataHoraSegundos(p.pagoEm) : formatarDataISO(p.dataPagamento)}
                      {p.banco && ` · ${p.banco}`}
                      {pagamentosAsaas[p.id] && ` · ${pagamentosAsaas[p.id]}`}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Secao>

        <SecaoCadastro titulo="Fornecedor" cadastro={fornecedor} nomeSalvo={primeira.fornecedorNome} />

        {pedido && <SecaoPedido pedido={pedido} />}
      </div>

      <DialogFooter>
        <Button nativeButton={false} variant="outline" render={<Link href={`/financeiro/${lancamentoId}`} />}>
          Editar lançamento
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Foto do cupom em miniatura; PDF (ou foto que não carregou) vira um ícone.
 * Clicar abre o cupom grande num modal, sem sair da tela.
 */
function MiniaturaCupom({ url, legenda }: { url: string; legenda?: string }) {
  const [semImagem, setSemImagem] = useState(false);
  const [ampliado, setAmpliado] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAmpliado(true)}
        title="Ver o cupom maior"
        className="group flex flex-col items-center gap-1 text-xs text-muted-foreground"
      >
        {semImagem ? (
          <span className="flex size-32 flex-col items-center justify-center gap-2 rounded-lg border bg-muted/40 transition-colors group-hover:bg-muted">
            <FileTextIcon className="size-8" />
            Ver arquivo
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela nossa rota.
          <img
            src={url}
            alt="Foto do cupom"
            onError={() => setSemImagem(true)}
            className="size-32 rounded-lg border object-cover transition-opacity group-hover:opacity-90"
          />
        )}
        {legenda}
      </button>

      <Dialog open={ampliado} onOpenChange={setAmpliado}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Cupom{legenda ? ` · ${legenda}` : ""}</DialogTitle>
          </DialogHeader>
          {semImagem ? (
            // PDF: o navegador mostra dentro do modal.
            <iframe src={url} title="Cupom" className="h-[75vh] w-full rounded-lg border" />
          ) : (
            <ImagemZoom src={url} alt="Foto do cupom" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Secao({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  );
}

function Campo({ rotulo, valor, largo }: { rotulo: string; valor?: string; largo?: boolean }) {
  return (
    <div className={largo ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd>{valor || "—"}</dd>
    </div>
  );
}
