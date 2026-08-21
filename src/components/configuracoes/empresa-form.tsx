"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { salvarEmpresa } from "@/server/empresa";
import { empresaSchema, type Empresa } from "@/lib/types";

export function EmpresaForm({ empresa }: { empresa: Empresa | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const parsed = empresaSchema.safeParse({
      nome: formData.get("nome"),
      cnpj: formData.get("cnpj"),
      endereco: formData.get("endereco"),
      telefone: formData.get("telefone"),
      email: formData.get("email"),
      site: formData.get("site"),
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    startTransition(async () => {
      try {
        await salvarEmpresa(parsed.data);
        toast.success("Dados da empresa salvos.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar dados da empresa.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex max-w-md flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="empresaNome">Nome da empresa</Label>
        <Input id="empresaNome" name="nome" defaultValue={empresa?.nome} className="uppercase" required />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="empresaCnpj">CNPJ</Label>
        <Input id="empresaCnpj" name="cnpj" defaultValue={empresa?.cnpj} className="uppercase" />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="empresaEndereco">Endereço</Label>
        <Input id="empresaEndereco" name="endereco" defaultValue={empresa?.endereco} className="uppercase" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="empresaTelefone">Telefone</Label>
          <Input id="empresaTelefone" name="telefone" defaultValue={empresa?.telefone} className="uppercase" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="empresaEmail">E-mail</Label>
          <Input id="empresaEmail" name="email" type="email" defaultValue={empresa?.email} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="empresaSite">Site</Label>
        <Input id="empresaSite" name="site" defaultValue={empresa?.site} />
      </div>

      <p className="text-xs text-muted-foreground">
        Logo e selo de distribuidor autorizado ficam em <code>public/empresa/</code> no projeto
        (arquivos <code>logo.png</code> e <code>selo.png</code>), não são cadastrados por aqui.
      </p>

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
