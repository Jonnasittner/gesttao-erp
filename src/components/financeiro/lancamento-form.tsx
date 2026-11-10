"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { atualizarLancamento, converterPedidoComLancamento, criarLancamento } from "@/server/financeiro";
import { converterEmPedido } from "@/server/pedidos";
import {
  CATEGORIA_CUSTO,
  FORMA_PAGAMENTO,
  MAX_PARCELAS,
  type CategoriaCusto,
  type ClasseDespesa,
  lancamentoSchema,
  type FormaPagamento,
  type Lancamento,
  type TipoLancamento,
} from "@/lib/types";
import { ROTULOS_CATEGORIA_CUSTO, ROTULOS_FORMA_PAGAMENTO } from "@/lib/rotulos";
import { formatarCodigo } from "@/lib/codigo";
import { formatarMoeda } from "@/lib/moeda";
import { hojeISO } from "@/lib/datetime";
import { BANCOS_SUGERIDOS, ID_LISTA_BANCOS, dividirValor, somarMeses } from "@/lib/financeiro";

export type CadastroOpcao = { value: string; label: string };

export type PedidoOpcao = {
  value: string;
  label: string;
  cadastroId: string;
  total: number;
};

interface LancamentoFormProps {
  clientes: CadastroOpcao[];
  fornecedores: CadastroOpcao[];
  pedidos: PedidoOpcao[];
  bancosUsados: string[];
  /** Plano de contas das despesas (todas; as inativas só aparecem se já escolhidas). */
  classes: ClasseDespesa[];
  /** Presente = edição (todas as parcelas do documento, em ordem). */
  parcelasSalvas?: Lancamento[];
  /** Lançamento aberto a partir de um pedido (cliente, pedido e tipo ficam travados). */
  vinculo?: VinculoPedido;
  /** Para onde voltar depois de salvar/cancelar na edição. */
  voltarPara?: string;
}

export interface VinculoPedido {
  pedidoId: string;
  numero: number;
  total: number;
  clienteId: string;
  clienteNome: string;
  tipo: TipoLancamento;
  /** true = "Transformar em pedido": salvar também converte o orçamento. */
  converter: boolean;
  categoria?: CategoriaCusto;
}

/** Uma linha da simulação de parcelas. */
interface ParcelaForm {
  chave: string;
  /** Id do documento já salvo (edição); "" para parcela nova. */
  id: string;
  vencimento: string;
  /** Data alterada à mão: não é recalculada quando muda o 1º vencimento. */
  dataEditada: boolean;
  valor: number;
  /** Texto do campo de valor (o que a pessoa digitou, ex.: "1500."). */
  valorTexto: string;
  /** Valor digitado à mão: fica fixo e o restante do total é rateado nas outras. */
  valorEditado: boolean;
  pago: boolean;
  dataPagamento: string;
  banco: string;
}

/**
 * Rateia o total entre as parcelas: as de valor digitado à mão ficam como
 * estão e o que sobra é dividido igualmente entre as demais
 * (ex.: 3.000 em 3x com a 1ª em 1.500 → 1.500 + 750 + 750).
 */
function ratearValores(total: number, parcelas: ParcelaForm[]): ParcelaForm[] {
  const livres = parcelas.filter((p) => !p.valorEditado).length;
  if (livres === 0) return parcelas;
  const fixo = parcelas.reduce((soma, p) => soma + (p.valorEditado ? p.valor : 0), 0);
  const restante = Math.max(0, Math.round((total - fixo) * 100) / 100);
  const valores = dividirValor(restante, livres);
  let j = 0;
  return parcelas.map((p) => {
    if (p.valorEditado) return p;
    const valor = valores[j++];
    return { ...p, valor, valorTexto: valor.toFixed(2) };
  });
}

/**
 * Refaz a simulação preservando o que já foi preenchido em cada posição
 * (data editada, valor digitado, recebido, banco).
 */
function montarParcelas(total: number, quantidade: number, primeiroVencimento: string, atuais: ParcelaForm[]) {
  const parcelas = Array.from({ length: quantidade }, (_, i): ParcelaForm => {
    const atual = atuais[i];
    return {
      chave: atual?.chave ?? crypto.randomUUID(),
      id: atual?.id ?? "",
      vencimento: atual?.dataEditada ? atual.vencimento : somarMeses(primeiroVencimento, i),
      dataEditada: atual?.dataEditada ?? false,
      valor: atual?.valor ?? 0,
      valorTexto: atual?.valorTexto ?? "",
      // Com uma parcela só, o valor é sempre o total.
      valorEditado: quantidade > 1 && (atual?.valorEditado ?? false),
      pago: atual?.pago ?? false,
      dataPagamento: atual?.dataPagamento || hojeISO(),
      banco: atual?.banco ?? "",
    };
  });
  return ratearValores(total > 0 ? total : 0, parcelas);
}

function parcelasIniciais(salvas: Lancamento[] | undefined, totalInicial = 0): ParcelaForm[] {
  if (!salvas?.length) return montarParcelas(totalInicial, 1, hojeISO(), []);
  const primeiro = salvas[0].vencimento;
  // Valor diferente do rateio igual = foi digitado à mão quando o lançamento foi criado.
  const iguais = dividirValor(salvas.reduce((soma, p) => soma + p.valor, 0), salvas.length);
  return salvas.map((p, i) => ({
    chave: p.id,
    id: p.id,
    vencimento: p.vencimento,
    dataEditada: i > 0 && p.vencimento !== somarMeses(primeiro, i),
    valor: p.valor,
    valorTexto: p.valor.toFixed(2),
    valorEditado: Math.round(p.valor * 100) !== Math.round(iguais[i] * 100),
    pago: p.status === "PAGO",
    dataPagamento: p.dataPagamento || hojeISO(),
    banco: p.banco,
  }));
}

export function LancamentoForm({
  clientes,
  fornecedores,
  pedidos,
  bancosUsados,
  classes,
  parcelasSalvas,
  vinculo,
  voltarPara: voltarEdicao,
}: LancamentoFormProps) {
  const router = useRouter();
  const base = parcelasSalvas?.[0];
  const editando = !!base;
  const [isPending, startTransition] = useTransition();

  const [tipo, setTipo] = useState<TipoLancamento>(vinculo?.tipo ?? base?.tipo ?? "RECEBER");
  const [categoria, setCategoria] = useState<CategoriaCusto>(
    base?.categoria || vinculo?.categoria || "MERCADORIA"
  );
  const [classeId, setClasseId] = useState(base?.classeId ?? "");
  const [subclasseId, setSubclasseId] = useState(base?.subclasseId ?? "");
  const clienteIdInicial = vinculo?.clienteId ?? base?.clienteId;
  const [cliente, setCliente] = useState<CadastroOpcao | null>(
    () =>
      clientes.find((c) => c.value === clienteIdInicial) ??
      opcaoSalva(clienteIdInicial, vinculo?.clienteNome ?? base?.clienteNome)
  );
  const [pedido, setPedido] = useState<PedidoOpcao | null>(
    () => pedidos.find((p) => p.value === (vinculo?.pedidoId ?? base?.pedidoId)) ?? null
  );
  const [fornecedor, setFornecedor] = useState<CadastroOpcao | null>(
    () =>
      fornecedores.find((f) => f.value === base?.fornecedorId) ?? opcaoSalva(base?.fornecedorId, base?.fornecedorNome)
  );
  const [numeroPedidoFornecedor, setNumeroPedidoFornecedor] = useState(base?.numeroPedidoFornecedor ?? "");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | null>(base?.formaPagamento ?? null);
  const [descricao, setDescricao] = useState(base?.descricao ?? "");

  // Recebimento de um pedido já começa com o total dele; custo começa vazio.
  const totalInicial = vinculo?.tipo === "RECEBER" ? vinculo.total : 0;
  const [valor, setValor] = useState(base ? String(base.valorTotal) : totalInicial ? String(totalInicial) : "");
  const [quantidade, setQuantidade] = useState(String(parcelasSalvas?.length || 1));
  const [primeiroVencimento, setPrimeiroVencimento] = useState(base?.vencimento ?? hojeISO());
  const [parcelas, setParcelas] = useState<ParcelaForm[]>(() => parcelasIniciais(parcelasSalvas, totalInicial));

  const aReceber = tipo === "RECEBER";
  const destino = vinculo ? `/pedidos/${vinculo.pedidoId}` : voltarEdicao || "/financeiro";
  const pedidosDoCliente = useMemo(
    () => (cliente ? pedidos.filter((p) => p.cadastroId === cliente.value) : []),
    [cliente, pedidos]
  );
  const sugestoesBanco = useMemo(() => [...new Set([...bancosUsados, ...BANCOS_SUGERIDOS])], [bancosUsados]);
  const somaParcelas = Math.round(parcelas.reduce((soma, p) => soma + p.valor, 0) * 100) / 100;
  /** Total − soma das parcelas, em reais (0 = fecha). */
  const diferenca = Math.round(((Number(valor) || 0) - somaParcelas) * 100) / 100;
  const algumValorEditado = parcelas.some((p) => p.valorEditado);
  // Inativas ficam de fora, menos a que o lançamento já usa.
  const classesOpcoes = classes.filter((c) => c.ativa || c.id === base?.classeId);
  const subclassesOpcoes = (classes.find((c) => c.id === classeId)?.subclasses ?? []).filter(
    (s) => s.ativa || s.id === base?.subclasseId
  );

  function escolherClasse(novo: string) {
    setClasseId(novo);
    const subs = classes.find((c) => c.id === novo)?.subclasses.filter((s) => s.ativa) ?? [];
    // Uma subclasse só: já escolhe; senão, obriga a escolher de novo.
    setSubclasseId(subs.length === 1 ? subs[0].id : "");
  }

  function escolherCliente(novo: CadastroOpcao | null) {
    setCliente(novo);
    if (pedido && pedido.cadastroId !== novo?.value) setPedido(null);
  }

  function escolherPedido(novo: PedidoOpcao | null) {
    setPedido(novo);
    // A receber: o valor normalmente é o total do pedido.
    if (novo && aReceber && !valor) alterarValor(String(novo.total));
  }

  function alterarValor(texto: string) {
    setValor(texto);
    setParcelas((atuais) => montarParcelas(Number(texto) || 0, atuais.length, primeiroVencimento, atuais));
  }

  function alterarQuantidade(texto: string) {
    setQuantidade(texto);
    const nova = Math.floor(Number(texto));
    if (!Number.isFinite(nova) || nova < 1 || nova > MAX_PARCELAS) return;

    const removidasPagas = parcelas.slice(nova).filter((p) => p.pago);
    if (removidasPagas.length) {
      toast.error(
        `A parcela ${parcelas.indexOf(removidasPagas[0]) + 1} já está marcada como ${aReceber ? "recebida" : "paga"}. Desmarque antes de diminuir as parcelas.`
      );
      setQuantidade(String(parcelas.length));
      return;
    }
    setParcelas((atuais) => montarParcelas(Number(valor) || 0, nova, primeiroVencimento, atuais));
  }

  function alterarPrimeiroVencimento(data: string) {
    setPrimeiroVencimento(data);
    if (!data) return;
    setParcelas((atuais) =>
      atuais.map((p, i) => (i === 0 ? { ...p, vencimento: data } : p.dataEditada ? p : { ...p, vencimento: somarMeses(data, i) }))
    );
  }

  function alterarParcela(indice: number, patch: Partial<ParcelaForm>) {
    // A data da 1ª parcela é o próprio 1º vencimento (e recalcula as seguintes).
    if (indice === 0 && patch.vencimento !== undefined) {
      alterarPrimeiroVencimento(patch.vencimento);
      return;
    }
    setParcelas((atuais) =>
      atuais.map((p, i) =>
        i === indice ? { ...p, ...patch, dataEditada: patch.vencimento !== undefined ? true : p.dataEditada } : p
      )
    );
  }

  /** Valor digitado numa parcela: fica fixo e o restante é rateado nas outras. */
  function alterarValorParcela(indice: number, texto: string) {
    const total = Number(valor) || 0;
    setParcelas((atuais) =>
      ratearValores(
        total,
        atuais.map((p, i) =>
          i === indice ? { ...p, valor: Math.round((Number(texto) || 0) * 100) / 100, valorTexto: texto, valorEditado: true } : p
        )
      )
    );
  }

  /** Volta todas as parcelas para o rateio igual. */
  function dividirIgualmente() {
    setParcelas((atuais) =>
      montarParcelas(
        Number(valor) || 0,
        atuais.length,
        primeiroVencimento,
        atuais.map((p) => ({ ...p, valorEditado: false }))
      )
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (String(parcelas.length) !== quantidade) {
      toast.error(`Informe um número de parcelas entre 1 e ${MAX_PARCELAS}.`);
      return;
    }
    if (diferenca !== 0) {
      toast.error(
        `A soma das parcelas (${formatarMoeda(somaParcelas)}) não bate com o valor total (${formatarMoeda(Number(valor) || 0)}).`
      );
      return;
    }

    const parsed = lancamentoSchema.safeParse({
      tipo,
      clienteId: cliente?.value ?? "",
      pedidoId: pedido?.value ?? "",
      fornecedorId: aReceber ? "" : fornecedor?.value ?? "",
      categoria: aReceber ? undefined : categoria,
      classeId: aReceber ? "" : classeId,
      subclasseId: aReceber ? "" : subclasseId,
      numeroPedidoFornecedor,
      formaPagamento: formaPagamento ?? undefined,
      valor,
      descricao,
      parcelas: parcelas.map((p) => ({
        id: p.id,
        vencimento: p.vencimento,
        valor: p.valor,
        status: p.pago ? "PAGO" : "PENDENTE",
        dataPagamento: p.pago ? p.dataPagamento : "",
        banco: p.pago ? p.banco : "",
      })),
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    startTransition(async () => {
      try {
        if (vinculo?.converter) {
          const { numeroDocumento } = await converterPedidoComLancamento(vinculo.pedidoId, parsed.data);
          toast.success(
            `Orçamento ${formatarCodigo(vinculo.numero)} transformado em pedido. Lançamento ${formatarCodigo(numeroDocumento)} criado.`
          );
          router.push(destino);
          router.refresh();
          return;
        }
        if (editando) {
          await atualizarLancamento(base.id, parsed.data);
          toast.success(`Lançamento ${formatarCodigo(base.numeroDocumento)} atualizado.`);
        } else {
          const { numeroDocumento, totalParcelas } = await criarLancamento(parsed.data);
          toast.success(
            `Lançamento ${formatarCodigo(numeroDocumento)} criado${totalParcelas > 1 ? ` em ${totalParcelas} parcelas` : ""}.`
          );
        }
        router.push(destino);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar lançamento.");
      }
    });
  }

  function gerarSemLancamento() {
    if (!vinculo?.converter) return;
    const codigo = formatarCodigo(vinculo.numero);
    if (!confirm(`Transformar o orçamento ${codigo} em pedido sem lançar no financeiro?`)) return;
    startTransition(async () => {
      try {
        await converterEmPedido(vinculo.pedidoId);
        toast.success(`Orçamento ${codigo} transformado em pedido.`);
        router.push(destino);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao transformar em pedido.");
      }
    });
  }


  return (
    <form onSubmit={handleSubmit} className="flex max-w-3xl flex-col gap-5">
      {/* Tipo */}
      <div className="grid grid-cols-2 gap-2">
        <BotaoTipo
          ativo={aReceber}
          onClick={() => setTipo("RECEBER")}
          desabilitado={!!vinculo && vinculo.tipo !== "RECEBER"}
          icone={<ArrowDownCircle className="size-5" />}
          titulo="A receber"
          subtitulo="Entrada de cliente"
          cor="emerald"
        />
        <BotaoTipo
          ativo={!aReceber}
          onClick={() => setTipo("PAGAR")}
          desabilitado={!!vinculo && vinculo.tipo !== "PAGAR"}
          icone={<ArrowUpCircle className="size-5" />}
          titulo="A pagar"
          subtitulo="Saída para fornecedor"
          cor="rose"
        />
      </div>

      {/* Tipo de custo e fornecedor (só a pagar) */}
      {!aReceber && (
        <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
          <Campo label="Tipo de custo">
            <Select
              value={categoria}
              items={ROTULOS_CATEGORIA_CUSTO}
              onValueChange={(v) => v && setCategoria(v as CategoriaCusto)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIA_CUSTO.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {ROTULOS_CATEGORIA_CUSTO[opcao]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label={categoria === "MERCADORIA" ? "Fornecedor" : "Fornecedor / prestador (opcional)"}>
            <SeletorCadastro
              opcoes={fornecedores}
              valor={fornecedor}
              onChange={setFornecedor}
              placeholder="Buscar fornecedor..."
              vazio="Nenhum fornecedor cadastrado com esse nome."
            />
          </Campo>
          <Campo label="Classe da despesa">
            <Select
              value={classeId || null}
              items={Object.fromEntries(classesOpcoes.map((c) => [c.id, c.nome]))}
              onValueChange={(v) => v && escolherClasse(v as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={classesOpcoes.length ? "Escolha a classe" : "Nenhuma classe cadastrada"} />
              </SelectTrigger>
              <SelectContent>
                {classesOpcoes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Subclasse">
            <div className="flex items-center gap-2">
              <Select
                value={subclasseId || null}
                items={Object.fromEntries(subclassesOpcoes.map((s) => [s.id, s.nome]))}
                onValueChange={(v) => v && setSubclasseId(v as string)}
                disabled={!classeId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={classeId ? "Escolha a subclasse" : "Escolha a classe antes"} />
                </SelectTrigger>
                <SelectContent>
                  {subclassesOpcoes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Link
                href="/financeiro/classes"
                target="_blank"
                className="shrink-0 text-xs text-primary hover:underline"
                title="Abre o cadastro de classes em outra aba"
              >
                Gerenciar
              </Link>
            </div>
          </Campo>
        </div>
      )}

      {/* Cliente, pedido e pedido do fornecedor (este vale para os dois tipos) */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo label={aReceber ? "Cliente" : "Cliente (opcional)"}>
          <SeletorCadastro
            opcoes={clientes}
            valor={cliente}
            onChange={escolherCliente}
            desabilitado={!!vinculo}
            placeholder="Buscar cliente..."
            vazio="Nenhum cliente encontrado."
          />
        </Campo>
        <Campo label="Pedido do cliente (opcional)">
          <Combobox
            items={pedidosDoCliente}
            value={pedido}
            onValueChange={(v) => escolherPedido(v)}
            disabled={!cliente || !!vinculo}
          >
            <ComboboxInput
              placeholder={cliente ? "Buscar pedido..." : "Escolha o cliente primeiro"}
              showClear={!vinculo}
              disabled={!cliente || !!vinculo}
            />
            <ComboboxContent>
              <ComboboxEmpty>Esse cliente não tem pedidos.</ComboboxEmpty>
              <ComboboxList>
                {(opcao: PedidoOpcao) => (
                  <ComboboxItem key={opcao.value} value={opcao}>
                    {opcao.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </Campo>
        <Campo label="Pedido do fornecedor (opcional)" htmlFor="numeroPedidoFornecedor">
          <Input
            id="numeroPedidoFornecedor"
            value={numeroPedidoFornecedor}
            onChange={(e) => setNumeroPedidoFornecedor(e.target.value)}
            placeholder="Nº do pedido"
            className="uppercase"
          />
        </Campo>
      </div>

      {/* Valor, forma, parcelas e 1º vencimento */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Campo label="Valor total (R$)" htmlFor="valor">
          <Input
            id="valor"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={valor}
            onChange={(e) => alterarValor(e.target.value)}
          />
        </Campo>
        <Campo label="Forma de pagamento">
          <Select
            value={formaPagamento}
            items={ROTULOS_FORMA_PAGAMENTO}
            onValueChange={(v) => setFormaPagamento(v as FormaPagamento | null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {FORMA_PAGAMENTO.map((forma) => (
                <SelectItem key={forma} value={forma}>
                  {ROTULOS_FORMA_PAGAMENTO[forma]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="Parcelas" htmlFor="quantidadeParcelas">
          <Input
            id="quantidadeParcelas"
            type="number"
            inputMode="numeric"
            min="1"
            max={MAX_PARCELAS}
            step="1"
            value={quantidade}
            onChange={(e) => alterarQuantidade(e.target.value)}
          />
        </Campo>
        <Campo label="1º vencimento" htmlFor="primeiroVencimento">
          <Input
            id="primeiroVencimento"
            type="date"
            value={primeiroVencimento}
            onChange={(e) => alterarPrimeiroVencimento(e.target.value)}
          />
        </Campo>
      </div>

      {/* Simulação das parcelas */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {parcelas.length > 1 ? `Simulação das ${parcelas.length} parcelas` : "Vencimento"}
          </h2>
          <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
            <span>
              {parcelas.length > 1 ? "Ajuste datas e valores se precisar." : "Ajuste a data se precisar."} Soma:{" "}
              <span className="font-semibold text-foreground">{formatarMoeda(somaParcelas)}</span>
            </span>
            {algumValorEditado && (
              <button type="button" onClick={dividirIgualmente} className="text-primary hover:underline">
                Dividir igualmente
              </button>
            )}
          </p>
        </div>

        {diferenca !== 0 && parcelas.length > 1 && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            {diferenca > 0
              ? `Faltam ${formatarMoeda(diferenca)} para fechar o total. Ajuste o valor de alguma parcela.`
              : `As parcelas passam ${formatarMoeda(-diferenca)} do total. Ajuste o valor de alguma parcela.`}
          </p>
        )}

        <datalist id={ID_LISTA_BANCOS}>
          {sugestoesBanco.map((banco) => (
            <option key={banco} value={banco} />
          ))}
        </datalist>

        <div className="overflow-hidden rounded-lg border">
          {/* Cabeçalho (PC) */}
          <div className="hidden grid-cols-[3.5rem_10rem_7.5rem_1fr] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
            <span>Parcela</span>
            <span>Vencimento</span>
            <span className="text-right">Valor</span>
            <span>{aReceber ? "Recebimento" : "Pagamento"}</span>
          </div>

          {parcelas.map((p, i) => (
            <div
              key={p.chave}
              className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 border-b px-3 py-2.5 last:border-b-0 sm:grid-cols-[3.5rem_10rem_7.5rem_1fr] ${
                p.pago ? "bg-emerald-50/60 dark:bg-emerald-950/20" : ""
              }`}
            >
              <span className="text-sm font-semibold tabular-nums">
                {i + 1}/{parcelas.length}
              </span>
              <Input
                type="date"
                aria-label={`Vencimento da parcela ${i + 1}`}
                value={p.vencimento}
                onChange={(e) => alterarParcela(i, { vencimento: e.target.value })}
                className="h-8"
              />
              {parcelas.length > 1 ? (
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  aria-label={`Valor da parcela ${i + 1}`}
                  title={p.valorEditado ? "Valor fixado à mão" : "Rateado automaticamente"}
                  value={p.valorTexto}
                  onChange={(e) => alterarValorParcela(i, e.target.value)}
                  className={`h-8 w-28 text-right tabular-nums sm:w-full ${p.valorEditado ? "font-semibold" : ""}`}
                />
              ) : (
                <span className="text-right text-sm font-medium tabular-nums">{formatarMoeda(p.valor)}</span>
              )}

              <div className="col-span-3 flex flex-wrap items-center gap-2 sm:col-span-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={p.pago} onCheckedChange={(v) => alterarParcela(i, { pago: v === true })} />
                  {aReceber ? "Recebida" : "Paga"}
                </label>
                {p.pago && (
                  <>
                    <Input
                      type="date"
                      aria-label={`Data de ${aReceber ? "recebimento" : "pagamento"} da parcela ${i + 1}`}
                      value={p.dataPagamento}
                      onChange={(e) => alterarParcela(i, { dataPagamento: e.target.value })}
                      className="h-8 w-auto"
                    />
                    <Input
                      list={ID_LISTA_BANCOS}
                      aria-label={`Banco da parcela ${i + 1}`}
                      placeholder="Banco"
                      value={p.banco}
                      onChange={(e) => alterarParcela(i, { banco: e.target.value })}
                      className="h-8 min-w-32 flex-1 uppercase"
                    />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Campo label="Descrição (opcional)" htmlFor="descricao">
        <Textarea
          id="descricao"
          rows={2}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="uppercase"
        />
      </Campo>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {vinculo?.converter && (
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={gerarSemLancamento}
            className="text-muted-foreground sm:mr-auto"
          >
            Gerar pedido sem lançamento financeiro
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => router.push(destino)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending
            ? "Salvando..."
            : vinculo?.converter
              ? "Gerar pedido"
              : editando
                ? "Salvar alterações"
                : vinculo?.tipo === "PAGAR"
                  ? "Salvar custo"
                  : "Salvar lançamento"}
        </Button>
      </div>
    </form>
  );
}

/** Cadastro que não está mais na lista (ex.: tipo alterado) ainda aparece na edição. */
function opcaoSalva(id?: string, nome?: string): CadastroOpcao | null {
  return id ? { value: id, label: nome || "Cadastro" } : null;
}

function Campo({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function SeletorCadastro({
  opcoes,
  valor,
  onChange,
  placeholder,
  vazio,
  desabilitado = false,
}: {
  opcoes: CadastroOpcao[];
  valor: CadastroOpcao | null;
  onChange: (v: CadastroOpcao | null) => void;
  placeholder: string;
  vazio: string;
  desabilitado?: boolean;
}) {
  return (
    <Combobox items={opcoes} value={valor} onValueChange={(v) => onChange(v)} disabled={desabilitado}>
      <ComboboxInput placeholder={placeholder} showClear={!desabilitado} disabled={desabilitado} />
      <ComboboxContent>
        <ComboboxEmpty>{vazio}</ComboboxEmpty>
        <ComboboxList>
          {(opcao: CadastroOpcao) => (
            <ComboboxItem key={opcao.value} value={opcao}>
              {opcao.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function BotaoTipo({
  ativo,
  onClick,
  icone,
  titulo,
  subtitulo,
  cor,
  desabilitado = false,
}: {
  desabilitado?: boolean;
  ativo: boolean;
  onClick: () => void;
  icone: React.ReactNode;
  titulo: string;
  subtitulo: string;
  cor: "emerald" | "rose";
}) {
  const classesAtivo =
    cor === "emerald"
      ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : "border-rose-600 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      aria-pressed={ativo}
      className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        ativo ? classesAtivo : "border-muted text-muted-foreground hover:bg-accent"
      }`}
    >
      {icone}
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{titulo}</span>
        <span className="text-xs opacity-80">{subtitulo}</span>
      </span>
    </button>
  );
}
