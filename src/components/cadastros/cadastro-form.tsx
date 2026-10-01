"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Loader2, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TextComboboxField } from "@/components/cadastros/text-combobox-field";
import { atualizarCadastro, buscarCadastroPorDocumento, criarCadastro } from "@/server/cadastros";
import { consultarCnpj, type DadosCnpj } from "@/server/cnpj";
import type { SugestoesEndereco } from "@/server/enderecos";
import { cadastroSchema, TIPO_CADASTRO, type Cadastro, type CadastroInput } from "@/lib/types";
import { formatarTelefone } from "@/lib/telefone";
import { formatarCpfCnpj } from "@/lib/documento";

/** Destaque dos campos preenchidos pela consulta ao CNPJ. */
const CLASSE_AUTO =
  "bg-amber-50 border-amber-300 focus-visible:border-amber-400 dark:bg-amber-500/10 dark:border-amber-700/70";

const ROTULOS_TIPO_CADASTRO: Record<(typeof TIPO_CADASTRO)[number], string> = {
  CLIENTE: "Cliente",
  FORNECEDOR: "Fornecedor / Prestador de serviço",
  INTERNO: "Cadastro interno",
};

/** Formata progressivamente: CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00) */
function formatarCpfCnpjInput(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    // CPF
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3}\.\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, "$1-$2");
  }
  // CNPJ
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2}\.\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/, "$1/$2")
    .replace(/^(\d{2}\.\d{3}\.\d{3}\/\d{4})(\d)/, "$1-$2");
}

function ModalDuplicata({
  cadastroDuplicado,
  onFechar,
  onAbrirCadastro,
}: {
  cadastroDuplicado: Cadastro;
  onFechar: () => void;
  onAbrirCadastro: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl ring-1 ring-foreground/10">
        {/* Ícone de alerta */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-500/15">
            <svg
              className="h-5 w-5 text-yellow-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold leading-tight">CPF/CNPJ já cadastrado</h2>
            <p className="text-sm text-muted-foreground">
              Este documento já existe no sistema
            </p>
          </div>
        </div>

        {/* Card com dados do duplicado */}
        <div className="mb-5 rounded-xl bg-muted/50 p-4 ring-1 ring-foreground/8">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
              #{String(cadastroDuplicado.codigo).padStart(4, "0")}
            </span>
            <span className="text-xs text-muted-foreground uppercase">
              {cadastroDuplicado.tipos.map((t) => ROTULOS_TIPO_CADASTRO[t]).join(", ")}
            </span>
          </div>
          <p className="mt-1 text-base font-semibold uppercase">{cadastroDuplicado.nome}</p>
          {cadastroDuplicado.documento && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {formatarCpfCnpj(cadastroDuplicado.documento)}
            </p>
          )}
          <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            {cadastroDuplicado.telefone && (
              <span>📞 {cadastroDuplicado.telefone}</span>
            )}
            {cadastroDuplicado.email && (
              <span>✉ {cadastroDuplicado.email}</span>
            )}
            {cadastroDuplicado.cidade && (
              <span>
                📍 {cadastroDuplicado.cidade}
                {cadastroDuplicado.estado ? ` — ${cadastroDuplicado.estado}` : ""}
              </span>
            )}
            <span>
              Status:{" "}
              <span
                className={
                  cadastroDuplicado.status === "ATIVO"
                    ? "font-medium text-green-600"
                    : "font-medium text-red-500"
                }
              >
                {cadastroDuplicado.status === "ATIVO" ? "Ativo" : "Inativo"}
              </span>
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="flex-1"
            onClick={onAbrirCadastro}
          >
            Abrir cadastro #{String(cadastroDuplicado.codigo).padStart(4, "0")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onFechar}
          >
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CadastroForm({
  cadastro,
  sugestoesEndereco,
}: {
  cadastro?: Cadastro;
  sugestoesEndereco: SugestoesEndereco;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCheckingDoc, setIsCheckingDoc] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [nome, setNome] = useState(cadastro?.nome ?? "");
  const [documento, setDocumento] = useState(formatarCpfCnpj(cadastro?.documento ?? ""));
  const [cidade, setCidade] = useState(cadastro?.cidade ?? "");
  const [estado, setEstado] = useState(cadastro?.estado ?? "");
  const [ramoAtividade, setRamoAtividade] = useState(cadastro?.ramoAtividade ?? "");
  const [telefone, setTelefone] = useState(formatarTelefone(cadastro?.telefone ?? ""));
  const [email, setEmail] = useState(cadastro?.email ?? "");
  const [endereco, setEndereco] = useState(cadastro?.endereco ?? "");
  const [numero, setNumero] = useState(cadastro?.numero ?? "");
  const [complemento, setComplemento] = useState(cadastro?.complemento ?? "");
  const [bairro, setBairro] = useState(cadastro?.bairro ?? "");
  const [cadastroDuplicado, setCadastroDuplicado] = useState<Cadastro | null>(null);

  // Campos preenchidos pela consulta ao CNPJ: ficam amarelos até serem editados.
  const [camposAuto, setCamposAuto] = useState<Set<string>>(new Set());
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const ultimoCnpjBuscado = useRef("");

  /** Classe do campo: amarelo quando veio da consulta. */
  function classeAuto(campo: string) {
    return camposAuto.has(campo) ? CLASSE_AUTO : "";
  }

  /** Ao editar à mão, o campo deixa de ser "automático" (sai o amarelo). */
  function editar(campo: string, definir: (valor: string) => void) {
    return (valor: string) => {
      definir(valor);
      setCamposAuto((atual) => {
        if (!atual.has(campo)) return atual;
        const novo = new Set(atual);
        novo.delete(campo);
        return novo;
      });
    };
  }

  function aplicarDadosCnpj(dados: DadosCnpj, sobrescrever: boolean) {
    const preenchidos: string[] = [];
    const aplicar = (campo: string, valorAtual: string, novoValor: string, definir: (v: string) => void) => {
      if (!novoValor) return;
      if (!sobrescrever && valorAtual.trim()) return;
      definir(novoValor);
      preenchidos.push(campo);
    };

    aplicar("nome", nome, dados.nome.toUpperCase(), setNome);
    aplicar("telefone", telefone, dados.telefone, setTelefone);
    aplicar("email", email, dados.email, setEmail);
    aplicar("endereco", endereco, dados.endereco.toUpperCase(), setEndereco);
    aplicar("numero", numero, dados.numero.toUpperCase(), setNumero);
    aplicar("complemento", complemento, dados.complemento.toUpperCase(), setComplemento);
    aplicar("bairro", bairro, dados.bairro.toUpperCase(), setBairro);
    aplicar("cidade", cidade, dados.cidade.toUpperCase(), setCidade);
    aplicar("estado", estado, dados.estado.toUpperCase(), setEstado);
    aplicar("ramoAtividade", ramoAtividade, dados.ramoAtividade.toUpperCase(), setRamoAtividade);

    setCamposAuto((atual) => new Set([...atual, ...preenchidos]));
    return preenchidos.length;
  }

  async function buscarCnpj(documentoBuscado: string, sobrescrever: boolean) {
    const digitos = documentoBuscado.replace(/\D/g, "");
    if (digitos.length !== 14) {
      toast.error("Informe os 14 dígitos do CNPJ para buscar.");
      return;
    }

    setBuscandoCnpj(true);
    ultimoCnpjBuscado.current = digitos;
    try {
      const resultado = await consultarCnpj(digitos);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }

      const quantos = aplicarDadosCnpj(resultado.dados, sobrescrever);
      if (quantos === 0) {
        toast.info("Os dados do CNPJ já estavam preenchidos.");
      } else {
        toast.success(`${resultado.dados.nome || "Empresa"}: ${quantos} campo${quantos === 1 ? "" : "s"} preenchido${quantos === 1 ? "" : "s"}.`);
      }
      if (resultado.dados.situacao && resultado.dados.situacao !== "ATIVA") {
        toast.warning(`Situação na Receita Federal: ${resultado.dados.situacao}.`);
      }
    } finally {
      setBuscandoCnpj(false);
    }
  }

  /** Digitou os 14 dígitos: busca sozinho (só completa o que está vazio). */
  function alterarDocumento(valor: string) {
    const formatado = formatarCpfCnpjInput(valor);
    setDocumento(formatado);
    const digitos = formatado.replace(/\D/g, "");
    if (digitos.length === 14 && digitos !== ultimoCnpjBuscado.current) {
      void buscarCnpj(digitos, false);
    }
  }

  /**
   * Ao digitar a cidade, completa o estado se essa cidade já foi usada antes
   * em outro cadastro (e o estado ainda estiver vazio).
   */
  function alterarCidade(valor: string) {
    editar("cidade", setCidade)(valor);
    if (estado.trim()) return;
    const conhecido = sugestoesEndereco.estadoPorCidade[valor.trim()];
    if (conhecido) setEstado(conhecido);
  }

  async function handleSubmit(formData: FormData) {
    // Verificar duplicata de CPF/CNPJ antes de tudo
    if (documento.replace(/\D/g, "")) {
      setIsCheckingDoc(true);
      try {
        const duplicado = await buscarCadastroPorDocumento(documento, cadastro?.id);
        if (duplicado) {
          setCadastroDuplicado(duplicado);
          setIsCheckingDoc(false);
          return;
        }
      } catch {
        // Ignora erro de rede e segue em frente
      }
      setIsCheckingDoc(false);
    }

    const raw: CadastroInput = {
      nome,
      documento,
      telefone,
      email,
      endereco,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      nomeContato: String(formData.get("nomeContato") ?? ""),
      observacaoContato: String(formData.get("observacaoContato") ?? ""),
      tipos: formData.getAll("tipos") as CadastroInput["tipos"],
      ramoAtividade,
      status: (formData.get("status") as "ATIVO" | "INATIVO" | "") || "ATIVO",
    };

    const parsed = cadastroSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErros(fieldErrors);
      return;
    }
    setErros({});

    startTransition(async () => {
      try {
        if (cadastro) {
          await atualizarCadastro(cadastro.id, parsed.data);
          toast.success("Cadastro atualizado.");
        } else {
          const { codigo } = await criarCadastro(parsed.data);
          toast.success(`Cadastro criado com o código ${String(codigo).padStart(4, "0")}.`);
        }
        router.push("/cadastros");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar cadastro.");
      }
    });
  }

  const isBusy = isPending || isCheckingDoc;

  return (
    <>
      {cadastroDuplicado && (
        <ModalDuplicata
          cadastroDuplicado={cadastroDuplicado}
          onFechar={() => setCadastroDuplicado(null)}
          onAbrirCadastro={() => {
            setCadastroDuplicado(null);
            router.push(`/cadastros/${cadastroDuplicado.id}`);
          }}
        />
      )}

      <form action={handleSubmit} className="flex max-w-xl flex-col gap-4">
        {/* Nome — com lista suspensa de sugestões */}
        <TextComboboxField
          id="nome"
          label="Nome *"
          value={nome}
          onChange={editar("nome", setNome)}
          suggestions={sugestoesEndereco.nome ?? []}
          className={classeAuto("nome")}
        />
        {erros.nome && <p className="text-sm text-destructive">{erros.nome}</p>}

        <div className="flex flex-col gap-2">
          <Label htmlFor="documento">CPF/CNPJ</Label>
          <div className="flex gap-2">
            <Input
              id="documento"
              value={documento}
              onChange={(e) => alterarDocumento(e.target.value)}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              inputMode="numeric"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              disabled={buscandoCnpj || documento.replace(/\D/g, "").length !== 14}
              onClick={() => buscarCnpj(documento, true)}
              title="Buscar os dados na Receita Federal e substituir o que já estiver preenchido"
            >
              {buscandoCnpj ? <Loader2 className="animate-spin" /> : <SearchIcon />}
              {buscandoCnpj ? "Buscando..." : "Buscar dados"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ao digitar um CNPJ completo, os dados vêm da Receita Federal e os campos preenchidos ficam{" "}
            <span className="rounded bg-amber-50 px-1 ring-1 ring-amber-300 dark:bg-amber-500/10 dark:ring-amber-700/70">
              em amarelo
            </span>
            . Dá para alterar tudo normalmente.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              name="telefone"
              value={telefone}
              onChange={(e) => editar("telefone", setTelefone)(formatarTelefone(e.target.value))}
              placeholder="(99) 9999-9999"
              inputMode="tel"
              className={classeAuto("telefone")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => editar("email", setEmail)(e.target.value)}
              className={classeAuto("email")}
            />
            {erros.email && <p className="text-sm text-destructive">{erros.email}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2 flex flex-col gap-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              value={endereco}
              onChange={(e) => editar("endereco", setEndereco)(e.target.value.toUpperCase())}
              className={`uppercase ${classeAuto("endereco")}`}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="numero">Número</Label>
            <Input
              id="numero"
              value={numero}
              onChange={(e) => editar("numero", setNumero)(e.target.value.toUpperCase())}
              className={`uppercase ${classeAuto("numero")}`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="complemento">Complemento</Label>
          <Input
            id="complemento"
            value={complemento}
            onChange={(e) => editar("complemento", setComplemento)(e.target.value.toUpperCase())}
            className={`uppercase ${classeAuto("complemento")}`}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2 flex flex-col gap-2">
            <Label htmlFor="bairro">Bairro</Label>
            <Input
              id="bairro"
              value={bairro}
              onChange={(e) => editar("bairro", setBairro)(e.target.value.toUpperCase())}
              className={`uppercase ${classeAuto("bairro")}`}
            />
          </div>
          {/* Cidade — com lista suspensa de sugestões */}
          <TextComboboxField
            id="cidade"
            label="Cidade"
            value={cidade}
            onChange={alterarCidade}
            suggestions={sugestoesEndereco.cidade}
            className={classeAuto("cidade")}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="estado">Estado</Label>
            <Input
              id="estado"
              name="estado"
              value={estado}
              onChange={(e) => editar("estado", setEstado)(e.target.value.toUpperCase())}
              className={`uppercase ${classeAuto("estado")}`}
              maxLength={2}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="nomeContato">Nome do contato</Label>
          <Input id="nomeContato" name="nomeContato" defaultValue={cadastro?.nomeContato} className="uppercase" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="observacaoContato">Observação do contato</Label>
          <Textarea
            id="observacaoContato"
            name="observacaoContato"
            rows={3}
            defaultValue={cadastro?.observacaoContato}
            className="uppercase"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Tipo *</Label>
          <div className="flex flex-col gap-2">
            {TIPO_CADASTRO.map((tipo) => (
              <label key={tipo} className="flex items-center gap-2 text-sm font-normal">
                <Checkbox
                  name="tipos"
                  value={tipo}
                  defaultChecked={cadastro?.tipos.includes(tipo) ?? false}
                />
                {ROTULOS_TIPO_CADASTRO[tipo]}
              </label>
            ))}
          </div>
          {erros.tipos && <p className="text-sm text-destructive">{erros.tipos}</p>}
        </div>

        <TextComboboxField
          id="ramoAtividade"
          label="Ramo de atividade"
          value={ramoAtividade}
          onChange={editar("ramoAtividade", setRamoAtividade)}
          suggestions={sugestoesEndereco.ramoAtividade}
          className={classeAuto("ramoAtividade")}
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status</Label>
          <Select
            name="status"
            items={{ ATIVO: "Ativo", INATIVO: "Inativo" }}
            defaultValue={cadastro?.status ?? "ATIVO"}
          >
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ATIVO">Ativo</SelectItem>
              <SelectItem value="INATIVO">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" disabled={isBusy} className="w-fit">
          {isCheckingDoc ? "Verificando documento..." : isPending ? "Salvando..." : cadastro ? "Salvar alterações" : "Criar cadastro"}
        </Button>
      </form>
    </>
  );
}
