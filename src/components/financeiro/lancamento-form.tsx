"use client";

import { useMemo, useState, useTransition } from "react";
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
import { atualizarLancamento, criarLancamento } from "@/server/financeiro";
import {
  FORMA_PAGAMENTO,
  lancamentoSchema,
  type FormaPagamento,
  type Lancamento,
  type TipoLancamento,
} from "@/lib/types";
import { ROTULOS_FORMA_PAGAMENTO } from "@/lib/rotulos";
import { formatarCodigo } from "@/lib/codigo";
import { hojeISO } from "@/lib/datetime";

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
  /** Presente = edição. */
  lancamento?: Lancamento;
}

export function LancamentoForm({ clientes, fornecedores, pedidos, lancamento }: LancamentoFormProps) {
  const router = useRouter();
  const editando = !!lancamento;
  const [isPending, startTransition] = useTransition();

  const [tipo, setTipo] = useState<TipoLancamento>(lancamento?.tipo ?? "RECEBER");
  const [cliente, setCliente] = useState<CadastroOpcao | null>(
    () => clientes.find((c) => c.value === lancamento?.clienteId) ?? opcaoSalva(lancamento?.clienteId, lancamento?.clienteNome)
  );
  const [pedido, setPedido] = useState<PedidoOpcao | null>(
    () => pedidos.find((p) => p.value === lancamento?.pedidoId) ?? null
  );
  const [fornecedor, setFornecedor] = useState<CadastroOpcao | null>(
    () =>
      fornecedores.find((f) => f.value === lancamento?.fornecedorId) ??
      opcaoSalva(lancamento?.fornecedorId, lancamento?.fornecedorNome)
  );
  const [numeroPedidoFornecedor, setNumeroPedidoFornecedor] = useState(lancamento?.numeroPedidoFornecedor ?? "");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | null>(lancamento?.formaPagamento ?? null);
  const [valor, setValor] = useState(lancamento ? String(lancamento.valor) : "");
  const [vencimento, setVencimento] = useState(lancamento?.vencimento ?? hojeISO());
  const [pago, setPago] = useState(lancamento?.status === "PAGO");
  const [dataPagamento, setDataPagamento] = useState(lancamento?.dataPagamento || hojeISO());
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? "");

  const aReceber = tipo === "RECEBER";
  const pedidosDoCliente = useMemo(
    () => (cliente ? pedidos.filter((p) => p.cadastroId === cliente.value) : []),
    [cliente, pedidos]
  );

  function escolherCliente(novo: CadastroOpcao | null) {
    setCliente(novo);
    if (pedido && pedido.cadastroId !== novo?.value) setPedido(null);
  }

  function escolherPedido(novo: PedidoOpcao | null) {
    setPedido(novo);
    // A receber: o valor normalmente é o total do pedido.
    if (novo && aReceber && !valor) setValor(String(novo.total));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = lancamentoSchema.safeParse({
      tipo,
      clienteId: cliente?.value ?? "",
      pedidoId: pedido?.value ?? "",
      fornecedorId: aReceber ? "" : fornecedor?.value ?? "",
      numeroPedidoFornecedor: aReceber ? "" : numeroPedidoFornecedor,
      formaPagamento: formaPagamento ?? undefined,
      valor,
      vencimento,
      status: pago ? "PAGO" : "PENDENTE",
      dataPagamento: pago ? dataPagamento : "",
      descricao,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    startTransition(async () => {
      try {
        if (editando) {
          await atualizarLancamento(lancamento.id, parsed.data);
          toast.success(`Lançamento ${formatarCodigo(lancamento.numeroDocumento)} atualizado.`);
        } else {
          const { numeroDocumento } = await criarLancamento(parsed.data);
          toast.success(`Lançamento ${formatarCodigo(numeroDocumento)} criado.`);
        }
        router.push("/financeiro");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar lançamento.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-5">
      {/* Tipo */}
      <div className="grid grid-cols-2 gap-2">
        <BotaoTipo
          ativo={aReceber}
          onClick={() => setTipo("RECEBER")}
          icone={<ArrowDownCircle className="size-5" />}
          titulo="A receber"
          subtitulo="Entrada de cliente"
          cor="emerald"
        />
        <BotaoTipo
          ativo={!aReceber}
          onClick={() => setTipo("PAGAR")}
          icone={<ArrowUpCircle className="size-5" />}
          titulo="A pagar"
          subtitulo="Saída para fornecedor"
          cor="rose"
        />
      </div>

      {/* Fornecedor (só a pagar) */}
      {!aReceber && (
        <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
          <Campo label="Fornecedor">
            <SeletorCadastro
              opcoes={fornecedores}
              valor={fornecedor}
              onChange={setFornecedor}
              placeholder="Buscar fornecedor..."
              vazio="Nenhum fornecedor cadastrado com esse nome."
            />
          </Campo>
          <Campo label="Nº do pedido do fornecedor" htmlFor="numeroPedidoFornecedor">
            <Input
              id="numeroPedidoFornecedor"
              value={numeroPedidoFornecedor}
              onChange={(e) => setNumeroPedidoFornecedor(e.target.value)}
              className="uppercase"
            />
          </Campo>
        </div>
      )}

      {/* Cliente e pedido */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label={aReceber ? "Cliente" : "Cliente (opcional)"}>
          <SeletorCadastro
            opcoes={clientes}
            valor={cliente}
            onChange={escolherCliente}
            placeholder="Buscar cliente..."
            vazio="Nenhum cliente encontrado."
          />
        </Campo>
        <Campo label="Pedido (opcional)">
          <Combobox
            items={pedidosDoCliente}
            value={pedido}
            onValueChange={(v) => escolherPedido(v)}
            disabled={!cliente}
          >
            <ComboboxInput
              placeholder={cliente ? "Buscar pedido..." : "Escolha o cliente primeiro"}
              showClear
              disabled={!cliente}
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
      </div>

      {/* Valor, forma e vencimento */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo label="Valor (R$)" htmlFor="valor">
          <Input
            id="valor"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
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
        <Campo label="Vencimento" htmlFor="vencimento">
          <Input id="vencimento" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
        </Campo>
      </div>

      {/* Já pago? */}
      <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <Checkbox checked={pago} onCheckedChange={(v) => setPago(v === true)} />
          {aReceber ? "Já foi recebido" : "Já foi pago"}
        </label>
        {pago && (
          <div className="flex items-center gap-2">
            <Label htmlFor="dataPagamento" className="shrink-0 text-sm text-muted-foreground">
              {aReceber ? "Recebido em" : "Pago em"}
            </Label>
            <Input
              id="dataPagamento"
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              className="w-auto"
            />
          </div>
        )}
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

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push("/financeiro")}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : editando ? "Salvar alterações" : "Salvar lançamento"}
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

function SeletorCadastro({
  opcoes,
  valor,
  onChange,
  placeholder,
  vazio,
}: {
  opcoes: CadastroOpcao[];
  valor: CadastroOpcao | null;
  onChange: (v: CadastroOpcao | null) => void;
  placeholder: string;
  vazio: string;
}) {
  return (
    <Combobox items={opcoes} value={valor} onValueChange={(v) => onChange(v)}>
      <ComboboxInput placeholder={placeholder} showClear />
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
}: {
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
      aria-pressed={ativo}
      className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors ${
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

