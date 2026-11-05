"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { ALVO_TITULO_CELULAR, ALVO_TITULO_PC } from "@/lib/titulo-tela";

const semInscricao = () => () => {};

/**
 * Cabeçalho padrão das telas. O título (e o selo) vai para o centro da
 * linha do topo, junto das notificações e do usuário, para sobrar espaço
 * para o conteúdo. Na própria tela fica só uma linha compacta com o
 * "voltar", um detalhe curto e as ações — e nada, se não houver nenhum.
 */
export function PageHeader({
  titulo,
  descricao,
  acoes,
  voltar,
  selo,
}: {
  titulo: React.ReactNode;
  /** Detalhe curto do registro (ex.: "Criado em 05/11/2026"); textos explicativos não vão aqui. */
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
  voltar?: { href: string; label: string };
  selo?: React.ReactNode;
}) {
  // O topo só existe no navegador; no servidor (e na 1ª renderização) não há onde pôr o título.
  const noNavegador = useSyncExternalStore(semInscricao, () => true, () => false);
  const alvoPc = noNavegador ? document.getElementById(ALVO_TITULO_PC) : null;
  const alvoCelular = noNavegador ? document.getElementById(ALVO_TITULO_CELULAR) : null;

  return (
    <>
      {alvoPc &&
        createPortal(
          <span className="flex min-w-0 items-center justify-center gap-2">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">{titulo}</h1>
            {selo}
          </span>,
          alvoPc,
        )}
      {alvoCelular &&
        createPortal(
          <span className="flex min-w-0 items-center justify-center gap-1.5">
            <span className="truncate text-sm font-medium text-muted-foreground">{titulo}</span>
            {selo}
          </span>,
          alvoCelular,
        )}

      {(voltar || descricao || acoes) && (
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {voltar && (
            <Link
              href={voltar.href}
              className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeftIcon className="size-3.5" /> {voltar.label}
            </Link>
          )}
          {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
          {acoes && <div className="ml-auto flex flex-wrap items-center gap-2">{acoes}</div>}
        </header>
      )}
    </>
  );
}
