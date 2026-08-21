"use client";

import { useRouter } from "next/navigation";
import { NovoProdutoDialog } from "@/components/pedidos/novo-produto-dialog";

export function NovoProdutoBotao() {
  const router = useRouter();
  return <NovoProdutoDialog onSalvo={() => router.refresh()} />;
}
