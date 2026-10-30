"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/server/auth-actions";

/**
 * Usuário logado no topo da tela, depois das notificações: avatar e primeiro
 * nome; ao clicar, e-mail, Configurações e Sair.
 */
export function MenuUsuario({ nome, email, iniciais }: { nome: string; email: string; iniciais: string }) {
  const [saindo, startTransition] = useTransition();
  const primeiroNome = nome.split(" ")[0] || nome;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-xl p-1 pr-2 text-sm font-medium text-foreground transition-colors hover:bg-muted data-popup-open:bg-muted"
        aria-label={`Conta de ${nome}`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/15">
          {iniciais}
        </span>
        <span className="hidden max-w-32 truncate sm:inline">{primeiroNome}</span>
        <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5">
            <span className="truncate text-sm font-semibold text-foreground">{nome}</span>
            {email && <span className="truncate text-xs font-normal">{email}</span>}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/configuracoes" />}>
          <Settings /> Configurações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={saindo} onClick={() => startTransition(() => logoutAction())}>
          <LogOut /> {saindo ? "Saindo…" : "Sair da conta"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
