"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CadastroForm } from "@/components/cadastros/cadastro-form";
import type { SugestoesEndereco } from "@/lib/sugestoes-endereco";

export type ClienteSalvo = { id: string; nome: string; cidade: string; estado: string };

/**
 * Botão "+" ao lado do campo de cliente do orçamento: abre o mesmo
 * formulário da tela de cadastros (com "Cliente" já marcado) e, ao salvar,
 * devolve o cliente para ser escolhido no orçamento sem sair da janela.
 */
export function NovoClienteDialog({
  sugestoesEndereco,
  onSalvo,
}: {
  sugestoesEndereco: SugestoesEndereco;
  onSalvo: (cliente: ClienteSalvo) => void;
}) {
  const [aberto, setAberto] = useState(false);
  // Remonta o formulário a cada abertura, para começar sempre em branco.
  const [chave, setChave] = useState(0);

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (v) setChave((c) => c + 1);
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            title="Cadastrar novo cliente"
            aria-label="Cadastrar novo cliente"
          >
            <PlusIcon />
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
        </DialogHeader>
        <CadastroForm
          key={chave}
          sugestoesEndereco={sugestoesEndereco}
          tiposPadrao={["CLIENTE"]}
          onSalvo={(cliente) => {
            onSalvo(cliente);
            setAberto(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
