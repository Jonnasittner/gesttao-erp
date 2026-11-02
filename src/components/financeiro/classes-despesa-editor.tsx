"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, EyeIcon, EyeOffIcon, PencilIcon, PlusIcon, SparklesIcon, Trash2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  alterarClasseAtiva,
  alterarSubclasseAtiva,
  criarClasse,
  criarClassesSugeridas,
  criarSubclasse,
  excluirClasse,
  excluirSubclasse,
  renomearClasse,
  renomearSubclasse,
} from "@/server/classes-despesa";
import { desembrulhar, type Resultado } from "@/lib/resultado";
import { cn } from "@/lib/utils";
import type { ClasseDespesa } from "@/lib/types";

/** Roda a action, mostra o erro real e atualiza a tela. */
function useAcao() {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  function executar<T>(acao: () => Promise<Resultado<T>>, sucesso?: string, depois?: () => void) {
    startTransition(async () => {
      try {
        desembrulhar(await acao());
        if (sucesso) toast.success(sucesso);
        depois?.();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
      }
    });
  }
  return { pendente, executar };
}

export function ClassesDespesaEditor({ classes }: { classes: ClasseDespesa[] }) {
  const { pendente, executar } = useAcao();
  const [novaClasse, setNovaClasse] = useState("");

  function adicionarClasse(e: React.FormEvent) {
    e.preventDefault();
    executar(() => criarClasse(novaClasse), "Classe criada.", () => setNovaClasse(""));
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={adicionarClasse} className="superficie flex flex-col gap-2 p-3 sm:flex-row">
        <Input
          value={novaClasse}
          onChange={(e) => setNovaClasse(e.target.value)}
          placeholder="Nova classe (ex.: ADMINISTRATIVO)"
          className="uppercase"
          maxLength={60}
        />
        <Button type="submit" disabled={pendente || !novaClasse.trim()}>
          <PlusIcon /> Adicionar classe
        </Button>
      </form>

      {classes.length === 0 && (
        <div className="superficie flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma classe cadastrada ainda.</p>
          <Button
            type="button"
            variant="outline"
            disabled={pendente}
            onClick={() => executar(() => criarClassesSugeridas(), "Classes sugeridas criadas. Ajuste como quiser.")}
          >
            <SparklesIcon /> Começar com classes sugeridas
          </Button>
        </div>
      )}

      {classes.map((c) => (
        <CartaoClasse key={c.id} classe={c} />
      ))}
    </div>
  );
}

function CartaoClasse({ classe }: { classe: ClasseDespesa }) {
  const { pendente, executar } = useAcao();
  const [novaSub, setNovaSub] = useState("");

  function adicionarSub(e: React.FormEvent) {
    e.preventDefault();
    executar(() => criarSubclasse(classe.id, novaSub), undefined, () => setNovaSub(""));
  }

  return (
    <section className={cn("superficie flex flex-col gap-3 p-3 sm:p-4", !classe.ativa && "opacity-60")}>
      <div className="flex items-center gap-2">
        <NomeEditavel
          nome={classe.nome}
          className="text-base font-semibold"
          onSalvar={(nome, depois) => executar(() => renomearClasse(classe.id, nome), undefined, depois)}
          pendente={pendente}
        />
        {!classe.ativa && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase">Inativa</span>}
        <div className="ml-auto flex items-center gap-1">
          <BotaoAtiva
            ativa={classe.ativa}
            pendente={pendente}
            onClick={() => executar(() => alterarClasseAtiva(classe.id, !classe.ativa))}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={pendente}
            aria-label={`Excluir a classe ${classe.nome}`}
            title="Excluir classe"
            onClick={() => {
              if (confirm(`Excluir a classe ${classe.nome} e todas as subclasses dela?`)) {
                executar(() => excluirClasse(classe.id), "Classe excluída.");
              }
            }}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      <ul className="flex flex-col divide-y rounded-lg border">
        {classe.subclasses.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">Nenhuma subclasse. Toda conta a pagar precisa de uma.</li>
        )}
        {classe.subclasses.map((s) => (
          <li key={s.id} className={cn("flex items-center gap-2 px-3 py-1.5", !s.ativa && "opacity-60")}>
            <NomeEditavel
              nome={s.nome}
              className="text-sm"
              onSalvar={(nome, depois) => executar(() => renomearSubclasse(classe.id, s.id, nome), undefined, depois)}
              pendente={pendente}
            />
            {!s.ativa && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase">Inativa</span>}
            <div className="ml-auto flex items-center gap-1">
              <BotaoAtiva
                ativa={s.ativa}
                pendente={pendente}
                onClick={() => executar(() => alterarSubclasseAtiva(classe.id, s.id, !s.ativa))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={pendente}
                aria-label={`Excluir a subclasse ${s.nome}`}
                title="Excluir subclasse"
                onClick={() => {
                  if (confirm(`Excluir a subclasse ${s.nome}?`)) {
                    executar(() => excluirSubclasse(classe.id, s.id), "Subclasse excluída.");
                  }
                }}
              >
                <Trash2Icon />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={adicionarSub} className="flex gap-2">
        <Input
          value={novaSub}
          onChange={(e) => setNovaSub(e.target.value)}
          placeholder={`Nova subclasse em ${classe.nome}`}
          className="h-8 uppercase"
          maxLength={60}
        />
        <Button type="submit" size="sm" variant="outline" disabled={pendente || !novaSub.trim()}>
          <PlusIcon /> Subclasse
        </Button>
      </form>
    </section>
  );
}

function NomeEditavel({
  nome,
  className,
  onSalvar,
  pendente,
}: {
  nome: string;
  className?: string;
  onSalvar: (nome: string, depois: () => void) => void;
  pendente: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(nome);

  if (!editando) {
    return (
      <span className="group flex min-w-0 items-center gap-1">
        <span className={cn("truncate", className)}>{nome}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Renomear ${nome}`}
          title="Renomear"
          className="opacity-60 group-hover:opacity-100"
          onClick={() => {
            setValor(nome);
            setEditando(true);
          }}
        >
          <PencilIcon />
        </Button>
      </span>
    );
  }

  return (
    <form
      className="flex min-w-0 flex-1 items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (valor.trim().toUpperCase() === nome) return setEditando(false);
        onSalvar(valor, () => setEditando(false));
      }}
    >
      <Input
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setEditando(false)}
        className="h-8 uppercase"
        maxLength={60}
      />
      <Button type="submit" variant="ghost" size="icon-sm" disabled={pendente} aria-label="Salvar nome">
        <CheckIcon />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditando(false)} aria-label="Cancelar">
        <XIcon />
      </Button>
    </form>
  );
}

function BotaoAtiva({ ativa, pendente, onClick }: { ativa: boolean; pendente: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={pendente}
      onClick={onClick}
      aria-label={ativa ? "Inativar" : "Reativar"}
      title={ativa ? "Inativar (some das opções de lançamentos novos)" : "Reativar"}
    >
      {ativa ? <EyeIcon /> : <EyeOffIcon />}
    </Button>
  );
}
