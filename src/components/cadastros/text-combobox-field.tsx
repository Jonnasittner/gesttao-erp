"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Campo de texto livre com sugestões (valores já usados em outros
 * cadastros). A lista suspensa só abre ao pressionar ArrowDown/ArrowUp
 * ou ao digitar — nunca ao entrar no campo via Tab.
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
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtradas = (
    value.trim() ? suggestions.filter((s) => s.toLowerCase().includes(value.trim().toLowerCase())) : suggestions
  ).slice(0, 8);

  // Fechar ao clicar fora
  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
        setHighlightIndex(-1);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  // Rolar item destacado para a visão
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!aberto) {
          setAberto(true);
          setHighlightIndex(0);
        } else {
          setHighlightIndex((prev) => Math.min(prev + 1, filtradas.length - 1));
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!aberto) {
          setAberto(true);
          setHighlightIndex(filtradas.length - 1);
        } else {
          setHighlightIndex((prev) => Math.max(prev - 1, 0));
        }
      } else if (e.key === "Enter" && aberto && highlightIndex >= 0) {
        e.preventDefault();
        onChange(filtradas[highlightIndex]);
        setAberto(false);
        setHighlightIndex(-1);
      } else if (e.key === "Escape") {
        setAberto(false);
        setHighlightIndex(-1);
      } else if (e.key === "Tab") {
        // Tab fecha a lista e deixa o foco seguir normalmente
        setAberto(false);
        setHighlightIndex(-1);
      }
    },
    [aberto, filtradas, highlightIndex, onChange],
  );

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
          // Abre a lista ao digitar (não ao focar via Tab)
          setAberto(true);
          setHighlightIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        // onFocus removido intencionalmente: não abre ao Tab
      />
      {aberto && filtradas.length > 0 && (
        <div
          ref={listRef}
          className="absolute top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg bg-popover py-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {filtradas.map((item, i) => (
            <button
              key={item}
              type="button"
              className={`block w-full px-2.5 py-1.5 text-left text-sm uppercase ${
                i === highlightIndex ? "bg-accent" : "hover:bg-accent"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(item);
                setAberto(false);
                setHighlightIndex(-1);
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
