"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  Contact,
  LayoutDashboard,
  Loader2,
  Magnet,
  Package,
  ShoppingCart,
  Users,
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
  /** Rótulo da barra do celular (padrão: a primeira palavra do label). */
  curto?: string;
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
    titulo: "Financeiro",
    itens: [
      { href: "/financeiro?tipo=PAGAR", label: "Contas a pagar", curto: "A pagar", icon: ArrowUpCircle },
      { href: "/financeiro?tipo=RECEBER", label: "Contas a receber", curto: "A receber", icon: ArrowDownCircle },
    ],
  },
  {
    titulo: "Gestão",
    itens: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/leads", label: "Geração de Leads", icon: Magnet },
    ],
  },
];

const ITENS = GRUPOS.flatMap((g) => g.itens);

// Itens com query (ex.: /financeiro?tipo=PAGAR) só ficam ativos se os
// parâmetros da URL também baterem.
function useItemAtivo() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (href: string) => {
    const [caminho, query] = href.split("?");
    if (!pathname.startsWith(caminho)) return false;
    if (!query) return true;
    return [...new URLSearchParams(query)].every(([chave, valor]) => searchParams.get(chave) === valor);
  };
}

// Textos que só aparecem com a barra lateral aberta (ver AppShell: recolhida
// mostra só os ícones e abre ao passar o mouse).
const SO_ABERTA =
  "whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100 group-has-focus-visible/sidebar:opacity-100";

export function SidebarNav() {
  const itemAtivo = useItemAtivo();

  return (
    <nav className="flex flex-col gap-5 px-3 py-1">
      {GRUPOS.map((grupo) => (
        <div key={grupo.titulo} className="flex flex-col gap-1">
          {/* Recolhida, o título dá lugar a um traço separando os grupos. */}
          <div className="relative h-5 px-3 pb-1">
            <span
              className="absolute top-2 left-3 h-px w-6 bg-border transition-opacity duration-200 group-hover/sidebar:opacity-0 group-has-focus-visible/sidebar:opacity-0"
              aria-hidden
            />
            <p className={`text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase ${SO_ABERTA}`}>
              {grupo.titulo}
            </p>
          </div>
          {grupo.itens.map((item) => {
            const ativo = itemAtivo(item.href);

            return (
              <Link
                key={item.href}
                href={item.emBreve ? "#" : item.href}
                aria-disabled={item.emBreve}
                aria-current={ativo ? "page" : undefined}
                aria-label={item.label}
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
                  className={`size-4.5 shrink-0 transition-colors ${
                    ativo && !item.emBreve ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                <span className={`truncate ${SO_ABERTA}`}>{item.label}</span>
                {!item.emBreve && <IndicadorCarregando className="ml-auto" />}
                {item.emBreve && (
                  <span className={`ml-auto rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-muted-foreground/60 uppercase ${SO_ABERTA}`}>
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
  const itemAtivo = useItemAtivo();
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
        const ativo = itemAtivo(item.href);
        const curto = item.curto ?? item.label.split(" ")[0];

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
