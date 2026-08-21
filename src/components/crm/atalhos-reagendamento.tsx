"use client";

import { dataMaisMeses } from "@/lib/datetime";

const OPCOES = [
  { label: "+3 meses", meses: 3 },
  { label: "+6 meses", meses: 6 },
  { label: "+9 meses", meses: 9 },
  { label: "+1 ano", meses: 12 },
] as const;

export function AtalhosReagendamento({ onEscolher }: { onEscolher: (data: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {OPCOES.map((opcao) => (
        <button
          key={opcao.label}
          type="button"
          onClick={() => onEscolher(dataMaisMeses(opcao.meses))}
          className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {opcao.label}
        </button>
      ))}
    </div>
  );
}
