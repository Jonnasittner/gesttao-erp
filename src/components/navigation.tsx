"use client";

import Link, { useLinkStatus } from "next/link";
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
  type LucideIcon 
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

const NAV_ITEMS: NavItem[] = [
  { href: "/agendamentos", label: "Agendamentos", icon: Calendar },
  { href: "/cadastros", label: "Cadastros", icon: Contact },
  { href: "/crm", label: "CRM", icon: Users },
  { href: "/pedidos", label: "Pedidos", icon: ShoppingCart },
  { href: "/produtos", label: "Cadastro Produtos", icon: Package },
  { href: "/financeiro", label: "Financeiro", icon: Wallet, emBreve: true },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.emBreve ? "#" : item.href}
            aria-disabled={item.emBreve}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative group ${
              item.emBreve
                ? "cursor-not-allowed text-muted-foreground/40"
                : isActive
                ? "bg-primary/10 text-primary shadow-sm"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground hover:translate-x-1"
            }`}
          >
            {/* Visual active indicator bar on the left */}
            {isActive && !item.emBreve && (
              <span className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full" />
            )}
            
            <item.icon className={`h-4.5 w-4.5 transition-transform duration-200 ${
              isActive && !item.emBreve ? "text-primary scale-110" : "text-muted-foreground group-hover:text-foreground"
            }`} />
            
            <span>{item.label}</span>
            {!item.emBreve && <IndicadorCarregando className="ml-auto" />}
            
            {item.emBreve && (
              <span className="ml-auto text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground/60 border dark:border-white/5 scale-90">
                breve
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const mobileItems = NAV_ITEMS.filter((item) => !item.emBreve);

  return (
    <nav
      className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-around rounded-2xl border border-white/20 dark:border-white/5 bg-background/80 backdrop-blur-lg shadow-xl py-2 px-3 md:hidden animate-fade-in"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
    >
      {mobileItems.map((item) => {
        const isActive = pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-200 ${
              isActive 
                ? "text-primary scale-105" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className={`h-5 w-5 transition-transform ${isActive ? "stroke-[2.5px]" : "stroke-[2px]"}`} />
            <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
            <IndicadorCarregando className="absolute top-0.5 right-1" />
            {isActive && (
              <span className="h-1 w-1 rounded-full bg-primary animate-pulse" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
