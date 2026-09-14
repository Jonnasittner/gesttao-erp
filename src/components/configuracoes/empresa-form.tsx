"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { salvarEmpresa } from "@/server/empresa";
import { empresaSchema, type Empresa } from "@/lib/types";

// Os mesmos emblemas que saem no cabeçalho do PDF (public/empresa/*.png),
// para o campo do formulário deixar claro qual ícone acompanha cada contato.
const ROTULOS_EMBLEMA = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  site: "Site",
  email: "E-mail",
} as const;

function EmblemaContato({ nome }: { nome: keyof typeof ROTULOS_EMBLEMA }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/empresa/${nome}.png`} alt={ROTULOS_EMBLEMA[nome]} className="h-4 w-4" />;
}

export function EmpresaForm({ empresa }: { empresa: Empresa | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const parsed = empresaSchema.safeParse({
      nome: formData.get("nome"),
      cnpj: formData.get("cnpj"),
      endereco: formData.get("endereco"),
      telefone: formData.get("telefone"),
      instagram: formData.get("instagram"),
      site: formData.get("site"),
      email: formData.get("email"),
      observacaoPadraoPedido: formData.get("observacaoPadraoPedido"),
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
    <form key={empresa?.updatedAt ?? "empresa-form"} action={handleSubmit} className="flex max-w-md flex-col gap-3">
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
          <Label htmlFor="empresaTelefone" className="flex items-center gap-1.5">
            <EmblemaContato nome="whatsapp" />
            Telefone
          </Label>
          <Input id="empresaTelefone" name="telefone" defaultValue={empresa?.telefone} className="uppercase" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="empresaInstagram" className="flex items-center gap-1.5">
            <EmblemaContato nome="instagram" />
            Instagram
          </Label>
          <Input id="empresaInstagram" name="instagram" defaultValue={empresa?.instagram} placeholder="@suaempresa" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="empresaSite" className="flex items-center gap-1.5">
            <EmblemaContato nome="site" />
            Site
          </Label>
          <Input id="empresaSite" name="site" defaultValue={empresa?.site} placeholder="www.suaempresa.com.br" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="empresaEmail" className="flex items-center gap-1.5">
            <EmblemaContato nome="email" />
            E-mail
          </Label>
          <Input
            id="empresaEmail"
            name="email"
            type="email"
            defaultValue={empresa?.email}
            placeholder="contato@suaempresa.com.br"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="observacaoPadraoPedido">Observação padrão dos pedidos / orçamentos</Label>
        <Textarea
          id="observacaoPadraoPedido"
          name="observacaoPadraoPedido"
          rows={3}
          defaultValue={empresa?.observacaoPadraoPedido}
          placeholder="Prazo de Entrega de 8 a 15 dias Úteis..."
        />
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
