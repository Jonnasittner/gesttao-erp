"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  atualizarRamoAtividade,
  criarRamoAtividade,
  excluirRamoAtividade,
} from "@/server/ramos-atividade";
import type { RamoAtividade } from "@/lib/types";

export function RamoAtividadeField({
  ramosIniciais,
  defaultValue,
}: {
  ramosIniciais: RamoAtividade[];
  defaultValue?: string;
}) {
  const [ramos, setRamos] = useState(ramosIniciais);
  const [selecionado, setSelecionado] = useState(defaultValue ?? "");
  const [modalAberto, setModalAberto] = useState(false);

  const itemsCombobox = ramos.map((r) => ({ value: r.id, label: r.nome }));

  return (
    <>
      <div className="flex gap-2">
        <Combobox
          name="ramoAtividadeId"
          items={itemsCombobox}
          value={selecionado || null}
          onValueChange={(v) => setSelecionado((v as string | null) ?? "")}
        >
          <ComboboxInput
            className="w-full uppercase placeholder:normal-case"
            placeholder="Buscar ramo de atividade..."
            showClear
          />
          <ComboboxContent>
            <ComboboxEmpty>Nenhum ramo encontrado</ComboboxEmpty>
            <ComboboxList>
              {(item: { value: string; label: string }) => (
                <ComboboxItem key={item.value} value={item.value} className="uppercase">
                  {item.label}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setModalAberto(true)}
          title="Gerenciar ramos de atividade"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      <GerenciarRamosDialog
        open={modalAberto}
        onOpenChange={setModalAberto}
        ramos={ramos}
        onRamosChange={setRamos}
        selecionado={selecionado}
        onSelecionadoChange={setSelecionado}
      />
    </>
  );
}

function GerenciarRamosDialog({
  open,
  onOpenChange,
  ramos,
  onRamosChange,
  selecionado,
  onSelecionadoChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ramos: RamoAtividade[];
  onRamosChange: (ramos: RamoAtividade[]) => void;
  selecionado: string;
  onSelecionadoChange: (id: string) => void;
}) {
  const [novoNome, setNovoNome] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoNome, setEditandoNome] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCriar() {
    const nome = novoNome.trim().toUpperCase();
    if (!nome) return;

    startTransition(async () => {
      try {
        const { id } = await criarRamoAtividade({ nome });
        onRamosChange([...ramos, { id, nome, createdAt: new Date().toISOString() }]);
        setNovoNome("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao criar ramo de atividade.");
      }
    });
  }

  function iniciarEdicao(ramo: RamoAtividade) {
    setEditandoId(ramo.id);
    setEditandoNome(ramo.nome);
  }

  function handleSalvarEdicao(id: string) {
    const nome = editandoNome.trim().toUpperCase();
    if (!nome) return;

    startTransition(async () => {
      try {
        await atualizarRamoAtividade(id, { nome });
        onRamosChange(ramos.map((r) => (r.id === id ? { ...r, nome } : r)));
        setEditandoId(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao atualizar ramo de atividade.");
      }
    });
  }

  function handleExcluir(id: string) {
    if (!confirm("Excluir este ramo de atividade? Cadastros que já usam esse ramo manterão a referência, mas ela deixará de aparecer na lista.")) {
      return;
    }

    startTransition(async () => {
      try {
        await excluirRamoAtividade(id);
        onRamosChange(ramos.filter((r) => r.id !== id));
        if (selecionado === id) onSelecionadoChange("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao excluir ramo de atividade.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ramos de atividade</DialogTitle>
          <DialogDescription>Adicione, edite ou exclua as opções disponíveis.</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {ramos.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum ramo cadastrado ainda.</p>
          )}
          {ramos.map((ramo) => (
            <div
              key={ramo.id}
              data-ramo-row={ramo.nome}
              className="flex items-center gap-2 rounded-md px-1 py-1.5"
            >
              {editandoId === ramo.id ? (
                <>
                  <Input
                    value={editandoNome}
                    onChange={(e) => setEditandoNome(e.target.value)}
                    className="h-8 flex-1 uppercase"
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Salvar ${ramo.nome}`}
                    disabled={isPending}
                    onClick={() => handleSalvarEdicao(ramo.id)}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Cancelar edição"
                    onClick={() => setEditandoId(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm uppercase">{ramo.nome}</span>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Editar ${ramo.nome}`}
                    onClick={() => iniciarEdicao(ramo)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Excluir ${ramo.nome}`}
                    disabled={isPending}
                    onClick={() => handleExcluir(ramo.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 border-t pt-3">
          <Input
            placeholder="Novo ramo de atividade"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCriar();
              }
            }}
            className="h-8 flex-1 uppercase placeholder:normal-case"
          />
          <Button type="button" size="sm" disabled={isPending || !novoNome.trim()} onClick={handleCriar}>
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
