"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquareText, Trash2Icon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NovoProdutoDialog } from "@/components/pedidos/novo-produto-dialog";
import { ImagemProduto } from "@/components/produtos/imagem-produto";
import { excluirProduto } from "@/server/produtos";
import { formatarCodigo } from "@/lib/codigo";
import { formatarMoeda } from "@/lib/moeda";
import type { Produto } from "@/lib/types";

export function ProdutosTabela({ produtos }: { produtos: Produto[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const produtosFiltrados = termo
    ? produtos.filter(
        (produto) =>
          produto.nome.toLowerCase().includes(termo) ||
          (produto.codigoFornecedor ?? "").toLowerCase().includes(termo) ||
          formatarCodigo(produto.codigoInterno).includes(termo)
      )
    : produtos;

  function handleExcluir(produto: Produto) {
    if (!confirm(`Excluir o produto "${produto.nome}"?`)) return;
    startTransition(async () => {
      try {
        await excluirProduto(produto.id);
        toast.success("Produto excluído.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao excluir produto.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Buscar por nome, código do fornecedor ou código interno..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="sm:max-w-sm"
      />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-0">Imagem</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Código do fornecedor</TableHead>
              <TableHead>Código interno</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Custo m²</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {produtosFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {produtos.length === 0 ? "Nenhum produto cadastrado." : "Nenhum produto encontrado."}
                </TableCell>
              </TableRow>
            )}
            {produtosFiltrados.map((produto) => (
              <TableRow key={produto.id}>
                <TableCell>
                  {produto.imagemUrl ? (
                    <ImagemProduto url={produto.imagemUrl} alt={produto.nome} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-1.5">
                    {produto.nome}
                    {produto.observacao && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span className="text-muted-foreground hover:text-foreground">
                              <MessageSquareText className="size-3.5" />
                            </span>
                          }
                        />
                        <TooltipContent>{produto.observacao}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
                <TableCell>{produto.codigoFornecedor || "—"}</TableCell>
                <TableCell className="font-mono">{formatarCodigo(produto.codigoInterno)}</TableCell>
                <TableCell>{formatarMoeda(produto.preco)}</TableCell>
                <TableCell>{formatarMoeda(produto.custoM2)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <NovoProdutoDialog produto={produto} onSalvo={() => router.refresh()} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Excluir ${produto.nome}`}
                      disabled={isPending}
                      onClick={() => handleExcluir(produto)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
