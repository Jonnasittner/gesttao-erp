import Link from "next/link";
import { Contact, LayoutDashboard, LogOut, ShoppingCart, Users, Wallet } from "lucide-react";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/auth-actions";

const NAV_ITEMS = [
  { href: "/cadastros", label: "Cadastros", icon: Contact },
  { href: "/crm", label: "CRM", icon: Users },
  { href: "/pedidos", label: "Pedidos", icon: ShoppingCart, emBreve: true },
  { href: "/financeiro", label: "Financeiro", icon: Wallet, emBreve: true },
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
];

// Na barra inferior do celular só cabem os itens já disponíveis — sem os
// "em breve", pra não ocupar espaço com algo que ainda não faz nada.
const NAV_ITEMS_MOBILE = NAV_ITEMS.filter((item) => !item.emBreve);

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const nomeUsuario = session?.user?.name ?? session?.user?.email ?? "";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Cabeçalho — só no celular, já que a sidebar fica escondida */}
      <header className="flex items-center justify-between border-b px-4 py-3 md:hidden">
        <span className="text-lg font-semibold">Gesttão</span>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="icon" aria-label={`Sair (${nomeUsuario})`}>
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </header>

      {/* Sidebar — só no desktop/tablet */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/30 md:flex">
        <div className="px-4 py-5 text-lg font-semibold">Gesttão</div>

        <nav className="flex flex-1 flex-col gap-1 px-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.emBreve ? "#" : item.href}
              aria-disabled={item.emBreve}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                item.emBreve
                  ? "cursor-not-allowed text-muted-foreground/50"
                  : "text-foreground hover:bg-accent"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.emBreve && <span className="ml-auto text-xs">em breve</span>}
            </Link>
          ))}
        </nav>

        <div className="border-t px-4 py-4">
          <p className="mb-2 truncate text-sm text-muted-foreground">{nomeUsuario}</p>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Sair
            </Button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6">{children}</main>

      {/* Navegação inferior — só no celular */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV_ITEMS_MOBILE.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-foreground"
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
