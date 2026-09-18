"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Contact,
  LayoutDashboard,
  Loader2,
  Package,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

// Ícone girando no item clicado enquanto a próxima tela carrega. Precisa estar
// dentro do <Link>. O atraso evita piscar quando a troca é instantânea.
function IndicadorCarregando({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span aria-hidden className={`opacity-0 animate-[fadeIn_150ms_ease-out_120ms_forwards] ${className}`}>
      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
    </span>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  emBreve?: boolean;
}

interface GrupoNav {
  titulo: string;
  itens: NavItem[];
}

const GRUPOS: GrupoNav[] = [
  {
    titulo: "Dia a dia",
    itens: [
      { href: "/agendamentos", label: "Agendamentos", icon: Calendar },
      { href: "/crm", label: "CRM", icon: Users },
      { href: "/pedidos", label: "Pedidos", icon: ShoppingCart },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [
      { href: "/cadastros", label: "Clientes e fornecedores", icon: Contact },
      { href: "/produtos", label: "Produtos", icon: Package },
    ],
  },
  {
    titulo: "Gestão",
    itens: [
      { href: "/financeiro", label: "Financeiro", icon: Wallet },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

const ITENS = GRUPOS.flatMap((g) => g.itens);

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5 px-3 py-1">
      {GRUPOS.map((grupo) => (
        <div key={grupo.titulo} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
            {grupo.titulo}
          </p>
          {grupo.itens.map((item) => {
            const ativo = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.emBreve ? "#" : item.href}
                aria-disabled={item.emBreve}
                aria-current={ativo ? "page" : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                  item.emBreve
                    ? "cursor-not-allowed text-muted-foreground/40"
                    : ativo
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {ativo && !item.emBreve && (
                  <span className="absolute top-2 bottom-2 -left-3 w-1 rounded-r-full bg-primary" aria-hidden />
                )}
                <item.icon
                  className={`size-4.5 transition-colors ${
                    ativo && !item.emBreve ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                <span className="truncate">{item.label}</span>
                {!item.emBreve && <IndicadorCarregando className="ml-auto" />}
                {item.emBreve && (
                  <span className="ml-auto rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-muted-foreground/60 uppercase">
                    breve
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

// Com 8 itens a barra não cabe em telas estreitas: rola para o lado.
export function MobileNav() {
  const pathname = usePathname();
  const mobileItems = ITENS.filter((item) => !item.emBreve);
  const navRef = useRef<HTMLElement>(null);

  // Traz o item da tela atual para a parte visível da barra.
  useEffect(() => {
    navRef.current
      ?.querySelector("[aria-current=page]")
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between gap-1 overflow-x-auto rounded-2xl border bg-background/85 px-2 py-1.5 backdrop-blur-lg [scrollbar-width:none] sombra-alta md:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) * 0.5 + 0.375rem)" }}
    >
      {mobileItems.map((item) => {
        const ativo = pathname.startsWith(item.href);
        const curto = item.label.split(" ")[0];

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? "page" : undefined}
            className={`relative flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-colors ${
              ativo ? "bg-primary/10 text-primary" : "text-muted-foreground"
            }`}
          >
            <item.icon className={`size-5 ${ativo ? "stroke-[2.4px]" : "stroke-[1.9px]"}`} />
            <span className="text-[10px] font-semibold tracking-wide">{curto}</span>
            <IndicadorCarregando className="absolute top-0.5 right-1" />
          </Link>
        );
      })}
    </nav>
  );
}
