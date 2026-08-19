"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Campo de texto livre com sugestões (valores já usados em outros
 * cadastros). Não usa o Combobox do Base UI de propósito: aquele
 * componente reverte texto digitado que não foi selecionado da lista ao
 * perder o foco, o que é errado aqui — o valor final deve ser sempre o
 * que a pessoa digitou, mesmo que não bata com nenhuma sugestão.
 */
export function TextComboboxField({
  id,
  label,
  value,
  onChange,
  suggestions,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
}) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtradas = (
    value.trim() ? suggestions.filter((s) => s.toLowerCase().includes(value.trim().toLowerCase())) : suggestions
  ).slice(0, 8);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  return (
    <div className="relative flex flex-col gap-2" ref={containerRef}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        autoComplete="off"
        className="uppercase placeholder:normal-case"
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
      />
      {aberto && filtradas.length > 0 && (
        <div className="absolute top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg bg-popover py-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
          {filtradas.map((item) => (
            <button
              key={item}
              type="button"
              className="block w-full px-2.5 py-1.5 text-left text-sm uppercase hover:bg-accent"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(item);
                setAberto(false);
              }}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
