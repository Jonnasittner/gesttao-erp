"use client";

import { createContext, useContext, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { atendeTexto } from "@/lib/busca";

/**
 * Busca instantânea da lista de pedidos: filtra por cliente ou número enquanto
 * a pessoa digita, só no navegador (sem ir ao servidor nem ler o Firestore).
 * Os outros filtros continuam no servidor; este refina o que já veio.
 */

type Contexto = {
  texto: string;
  setTexto: (texto: string) => void;
  /** Quantos itens (do que o servidor mandou) batem com o texto. */
  visiveis: number;
};

const BuscaContexto = createContext<Contexto | null>(null);

function useBusca(): Contexto {
  const ctx = useContext(BuscaContexto);
  if (!ctx) throw new Error("Use dentro de <BuscaInstantanea>.");
  return ctx;
}



export function BuscaInstantanea({
  inicial,
  chaves,
  children,
}: {
  inicial: string;
  /** Chaves de todos os itens da lista, para contar os visíveis. */
  chaves: string[];
  children: React.ReactNode;
}) {
  const [texto, setTextoEstado] = useState(inicial);

  // Se o endereço mudar por navegação (Limpar, abas, voltar), o campo acompanha.
  const doEndereco = useSearchParams().get("cliente") ?? "";
  const [enderecoAnterior, setEnderecoAnterior] = useState(doEndereco);
  if (doEndereco !== enderecoAnterior) {
    setEnderecoAnterior(doEndereco);
    if (doEndereco !== texto) setTextoEstado(doEndereco);
  }

  function setTexto(novo: string) {
    setTextoEstado(novo);
    // Guarda no endereço (sem recarregar) para um F5 manter a busca.
    const params = new URLSearchParams(window.location.search);
    if (novo) params.set("cliente", novo);
    else params.delete("cliente");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `?${query}` : window.location.pathname,
    );
  }

  const visiveis = useMemo(
    () => chaves.filter((c) => atendeTexto(c, texto)).length,
    [chaves, texto],
  );

  return (
    <BuscaContexto.Provider value={{ texto, setTexto, visiveis }}>
      {children}
    </BuscaContexto.Provider>
  );
}

/** Campo da busca; mantém name="cliente" para o botão Filtrar levar junto. */
export function CampoBuscaInstantanea(
  props: Omit<React.ComponentProps<typeof Input>, "value" | "onChange">,
) {
  const { texto, setTexto } = useBusca();
  return (
    <Input
      {...props}
      type="search"
      name="cliente"
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
    />
  );
}

/** Mostra o item só se bater com o texto digitado. */
export function ItemBuscavel({
  chave,
  children,
}: {
  chave: string;
  children: React.ReactNode;
}) {
  const { texto } = useBusca();
  return atendeTexto(chave, texto) ? children : null;
}

/**
 * Mensagem de lista vazia: aparece quando nada sobra. `comTexto` escolhe a
 * versão de quando há algo digitado na busca (a página manda as duas prontas).
 */
export function VazioBusca({ comTexto, children }: { comTexto: boolean; children: React.ReactNode }) {
  const { texto, visiveis } = useBusca();
  return visiveis === 0 && Boolean(texto.trim()) === comTexto ? children : null;
}

/** "3 de 10 registros", contando também a busca digitada. */
export function ContagemBusca({
  total,
  filtrosServidor,
}: {
  total: number;
  filtrosServidor: boolean;
}) {
  const { texto, visiveis } = useBusca();
  const filtrando = filtrosServidor || Boolean(texto.trim());
  return (
    <span className="ml-auto text-xs text-muted-foreground">
      {filtrando ? `${visiveis} de ${total}` : total}{" "}
      {total === 1 && !filtrando ? "registro" : "registros"}
    </span>
  );
}

/** Link (das abas de situação) que leva junto o texto digitado. */
export function LinkComBusca({
  href,
  ...props
}: React.ComponentProps<typeof Link> & { href: string }) {
  const { texto } = useBusca();
  let destino = href;
  if (texto.trim()) {
    const [caminho, query = ""] = href.split("?");
    const params = new URLSearchParams(query);
    params.set("cliente", texto);
    destino = `${caminho}?${params.toString()}`;
  }
  return <Link href={destino} {...props} />;
}

/** Mostra o "Limpar" também quando só há texto digitado. */
export function SeHaBusca({
  filtrosServidor,
  children,
}: {
  filtrosServidor: boolean;
  children: React.ReactNode;
}) {
  const { texto } = useBusca();
  return filtrosServidor || texto.trim() ? children : null;
}
