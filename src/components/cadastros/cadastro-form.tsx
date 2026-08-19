"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { RamoAtividadeField } from "@/components/cadastros/ramo-atividade-field";
import { TextComboboxField } from "@/components/cadastros/text-combobox-field";
import { atualizarCadastro, criarCadastro } from "@/server/cadastros";
import type { SugestoesEndereco } from "@/server/enderecos";
import { cadastroSchema, TIPO_CADASTRO, type Cadastro, type CadastroInput, type RamoAtividade } from "@/lib/types";

const ROTULOS_TIPO_CADASTRO: Record<(typeof TIPO_CADASTRO)[number], string> = {
  CLIENTE: "Cliente",
  FORNECEDOR: "Fornecedor / Prestador de serviço",
  INTERNO: "Cadastro interno",
};

export function CadastroForm({
  cadastro,
  ramosAtividade,
  sugestoesEndereco,
}: {
  cadastro?: Cadastro;
  ramosAtividade: RamoAtividade[];
  sugestoesEndereco: SugestoesEndereco;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erros, setErros] = useState<Record<string, string>>({});
  const [endereco, setEndereco] = useState(cadastro?.endereco ?? "");
  const [numero, setNumero] = useState(cadastro?.numero ?? "");
  const [bairro, setBairro] = useState(cadastro?.bairro ?? "");
  const [cidade, setCidade] = useState(cadastro?.cidade ?? "");

  function handleSubmit(formData: FormData) {
    const raw: CadastroInput = {
      nome: String(formData.get("nome") ?? ""),
      documento: String(formData.get("documento") ?? ""),
      telefone: String(formData.get("telefone") ?? ""),
      email: String(formData.get("email") ?? ""),
      endereco,
      numero,
      bairro,
      cidade,
      nomeContato: String(formData.get("nomeContato") ?? ""),
      observacaoContato: String(formData.get("observacaoContato") ?? ""),
      tipos: formData.getAll("tipos") as CadastroInput["tipos"],
      ramoAtividadeId: String(formData.get("ramoAtividadeId") ?? ""),
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

  return (
    <form action={handleSubmit} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="nome">Nome *</Label>
        <Input id="nome" name="nome" defaultValue={cadastro?.nome} className="uppercase" required />
        {erros.nome && <p className="text-sm text-destructive">{erros.nome}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="documento">CPF/CNPJ</Label>
        <Input id="documento" name="documento" defaultValue={cadastro?.documento} className="uppercase" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input id="telefone" name="telefone" defaultValue={cadastro?.telefone} className="uppercase" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" defaultValue={cadastro?.email} />
          {erros.email && <p className="text-sm text-destructive">{erros.email}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <TextComboboxField
            id="endereco"
            label="Endereço"
            value={endereco}
            onChange={setEndereco}
            suggestions={sugestoesEndereco.endereco}
          />
        </div>
        <TextComboboxField
          id="numero"
          label="Número"
          value={numero}
          onChange={setNumero}
          suggestions={sugestoesEndereco.numero}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextComboboxField
          id="bairro"
          label="Bairro"
          value={bairro}
          onChange={setBairro}
          suggestions={sugestoesEndereco.bairro}
        />
        <TextComboboxField
          id="cidade"
          label="Cidade"
          value={cidade}
          onChange={setCidade}
          suggestions={sugestoesEndereco.cidade}
        />
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

      <div className="flex flex-col gap-2">
        <Label>Ramo de atividade</Label>
        <RamoAtividadeField ramosIniciais={ramosAtividade} defaultValue={cadastro?.ramoAtividadeId} />
      </div>

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

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Salvando..." : cadastro ? "Salvar alterações" : "Criar cadastro"}
      </Button>
    </form>
  );
}
