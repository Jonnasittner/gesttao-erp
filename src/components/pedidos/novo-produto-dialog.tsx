"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { criarProduto, atualizarProduto, enviarImagemProduto } from "@/server/produtos";
import { formatarCodigo } from "@/lib/codigo";
import type { Produto } from "@/lib/types";

export type ProdutoOpcao = {
  value: string;
  label: string;
  preco: number;
  custoM2: number;
  imagemUrl: string;
};

interface FormState {
  nome: string;
  preco: string;
  codigoFornecedor: string;
  custoM2: string;
  observacao: string;
}

function estadoInicial(produto?: Produto): FormState {
  return {
    nome: produto?.nome ?? "",
    preco: produto ? String(produto.preco) : "",
    codigoFornecedor: produto?.codigoFornecedor ?? "",
    custoM2: produto ? String(produto.custoM2) : "",
    observacao: produto?.observacao ?? "",
  };
}

export function NovoProdutoDialog({
  produto,
  onSalvo,
}: {
  /** Quando informado, o modal abre em modo edição pré-preenchido com este produto. */
  produto?: Produto;
  onSalvo: (produto: ProdutoOpcao) => void;
}) {
  const editando = !!produto;
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(() => estadoInicial(produto));
  const [imagemArquivo, setImagemArquivo] = useState<File | null>(null);
  const previewArquivo = useMemo(
    () => (imagemArquivo ? URL.createObjectURL(imagemArquivo) : null),
    [imagemArquivo]
  );
  const imagemExibida = previewArquivo ?? produto?.imagemUrl ?? "";

  useEffect(() => {
    return () => {
      if (previewArquivo) URL.revokeObjectURL(previewArquivo);
    };
  }, [previewArquivo]);

  function atualizar(patch: Partial<FormState>) {
    setForm((atual) => ({ ...atual, ...patch }));
  }

  // Preço de tabela sugerido: sempre o dobro do custo por m², mas o campo
  // continua editável caso o usuário queira ajustar.
  function atualizarCustoM2(value: string) {
    const custo = Number(value) || 0;
    setForm((atual) => ({ ...atual, custoM2: value, preco: String(custo * 2) }));
  }

  function handleSubmit() {
    const nome = form.nome.trim();
    const preco = Number(form.preco);
    const custoM2 = form.custoM2 ? Number(form.custoM2) : 0;

    if (!nome) {
      toast.error("Informe o nome do produto.");
      return;
    }
    if (!Number.isFinite(preco) || preco < 0) {
      toast.error("Informe um preço válido.");
      return;
    }
    if (!Number.isFinite(custoM2) || custoM2 < 0) {
      toast.error("Informe um custo por m² válido.");
      return;
    }

    const dados = {
      nome,
      preco,
      codigoFornecedor: form.codigoFornecedor.trim(),
      custoM2,
      observacao: form.observacao.trim(),
    };

    startTransition(async () => {
      try {
        let produtoId: string;
        let nomeSalvo = nome.toUpperCase();
        if (editando) {
          await atualizarProduto(produto.id, dados);
          produtoId = produto.id;
        } else {
          const novo = await criarProduto(dados);
          produtoId = novo.id;
          nomeSalvo = novo.nome;
        }

        if (imagemArquivo) {
          const imagemFormData = new FormData();
          imagemFormData.set("imagem", imagemArquivo);
          await enviarImagemProduto(produtoId, imagemFormData);
        }

        const temImagem = Boolean(imagemArquivo) || Boolean(produto?.imagemUrl);
        onSalvo({
          value: produtoId,
          label: nomeSalvo,
          preco,
          custoM2,
          imagemUrl: temImagem ? `/api/produtos/${produtoId}/imagem` : "",
        });

        toast.success(editando ? "Produto atualizado." : "Produto cadastrado.");
        if (!editando) {
          setForm(estadoInicial());
          setImagemArquivo(null);
        }
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar produto.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        setForm(estadoInicial(produto));
        setImagemArquivo(null);
      }}
    >
      <DialogTrigger
        render={
          editando ? (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar produto">
              <PencilIcon />
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm">
              Cadastrar Novo Produto
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="produtoNome">Nome</Label>
            <Input
              id="produtoNome"
              value={form.nome}
              onChange={(e) => atualizar({ nome: e.target.value })}
              className="uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="produtoCustoM2">Custo por m² (R$)</Label>
              <Input
                id="produtoCustoM2"
                type="number"
                min="0"
                step="0.01"
                value={form.custoM2}
                onChange={(e) => atualizarCustoM2(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="produtoPreco">Preço de tabela (R$)</Label>
              <Input
                id="produtoPreco"
                type="number"
                min="0"
                step="0.01"
                value={form.preco}
                onChange={(e) => atualizar({ preco: e.target.value })}
              />
            </div>
          </div>
          <span className="-mt-2 text-xs text-muted-foreground">Sugerido: 2x o custo por m²</span>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="produtoCodigoFornecedor">Código do fornecedor</Label>
              <Input
                id="produtoCodigoFornecedor"
                value={form.codigoFornecedor}
                onChange={(e) => atualizar({ codigoFornecedor: e.target.value })}
                className="uppercase"
              />
            </div>
            {editando && (
              <div className="flex flex-col gap-1">
                <Label>Código interno</Label>
                <p className="flex h-8 items-center font-mono text-sm text-muted-foreground">
                  {formatarCodigo(produto.codigoInterno)}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="produtoImagem">Imagem</Label>
            <div className="flex items-center gap-3">
              {imagemExibida && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagemExibida}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-md border object-cover"
                />
              )}
              <Input
                id="produtoImagem"
                type="file"
                accept="image/*"
                onChange={(e) => setImagemArquivo(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="produtoObservacao">Observação</Label>
            <Textarea
              id="produtoObservacao"
              rows={2}
              value={form.observacao}
              onChange={(e) => atualizar({ observacao: e.target.value })}
              className="uppercase"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" disabled={isPending} onClick={handleSubmit}>
            {isPending ? "Salvando..." : editando ? "Salvar alterações" : "Salvar produto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
