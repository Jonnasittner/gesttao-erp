"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
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
import type { SugestoesEndereco } from "@/server/enderecos";
import { cadastroSchema, TIPO_CADASTRO, type Cadastro, type CadastroInput } from "@/lib/types";
import { formatarTelefone } from "@/lib/telefone";
import { formatarCpfCnpj } from "@/lib/documento";

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
  const [cadastroDuplicado, setCadastroDuplicado] = useState<Cadastro | null>(null);

  // Se a cidade já foi cadastrada antes com um estado, preenche sozinho
  useEffect(() => {
    if (!cidade.trim() || estado.trim()) return;
    const conhecido = sugestoesEndereco.estadoPorCidade[cidade.trim()];
    if (conhecido) setEstado(conhecido);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cidade]);

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
      email: String(formData.get("email") ?? ""),
      endereco: String(formData.get("endereco") ?? ""),
      numero: String(formData.get("numero") ?? ""),
      complemento: String(formData.get("complemento") ?? ""),
      bairro: String(formData.get("bairro") ?? ""),
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
          onChange={setNome}
          suggestions={sugestoesEndereco.nome ?? []}
        />
        {erros.nome && <p className="text-sm text-destructive">{erros.nome}</p>}

        <div className="flex flex-col gap-2">
          <Label htmlFor="documento">CPF/CNPJ</Label>
          <Input
            id="documento"
            value={documento}
            onChange={(e) => setDocumento(formatarCpfCnpjInput(e.target.value))}
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
            inputMode="numeric"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              name="telefone"
              value={telefone}
              onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
              placeholder="(99) 9999-9999"
              inputMode="tel"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" defaultValue={cadastro?.email} />
            {erros.email && <p className="text-sm text-destructive">{erros.email}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2 flex flex-col gap-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              name="endereco"
              defaultValue={cadastro?.endereco}
              className="uppercase"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="numero">Número</Label>
            <Input
              id="numero"
              name="numero"
              defaultValue={cadastro?.numero}
              className="uppercase"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="complemento">Complemento</Label>
          <Input
            id="complemento"
            name="complemento"
            defaultValue={cadastro?.complemento}
            className="uppercase"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2 flex flex-col gap-2">
            <Label htmlFor="bairro">Bairro</Label>
            <Input
              id="bairro"
              name="bairro"
              defaultValue={cadastro?.bairro}
              className="uppercase"
            />
          </div>
          {/* Cidade — com lista suspensa de sugestões */}
          <TextComboboxField
            id="cidade"
            label="Cidade"
            value={cidade}
            onChange={setCidade}
            suggestions={sugestoesEndereco.cidade}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="estado">Estado</Label>
            <Input
              id="estado"
              name="estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value.toUpperCase())}
              className="uppercase"
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
          onChange={setRamoAtividade}
          suggestions={sugestoesEndereco.ramoAtividade}
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
