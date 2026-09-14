import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/auth-actions";
import { SidebarNav, MobileNav } from "@/components/navigation";

// A sessão é um JWT que continua válido mesmo depois de o usuário ser
// removido em Configurações. Ao abrir/recarregar o sistema, confere se ele
// ainda existe e, se não, encerra a sessão. Fica num Suspense próprio para
// não atrasar a exibição da tela.
async function VerificarAcesso({ usuarioId }: { usuarioId: string }) {
  const doc = await db.collection("usuarios").doc(usuarioId).get();
  if (!doc.exists) redirect("/api/sair");
  return null;
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const nomeUsuario = session?.user?.name ?? session?.user?.email ?? "";
  
  const iniciais = nomeUsuario
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "U";

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-background">
      {/* Cabeçalho — celular */}
      <header className="flex items-center justify-between border-b bg-background/80 backdrop-blur-md px-5 py-3.5 md:hidden sticky top-0 z-30">
        <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
          Gesttão
        </span>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold border border-primary/20">
            {iniciais}
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={`Sair (${nomeUsuario})`}>
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </header>

      {/* Sidebar — desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar md:flex shadow-sm">
        <div className="px-6 py-5 border-b border-sidebar-border/50">
          <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
            Gesttão
          </span>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav />
        </div>

        <div className="border-t border-sidebar-border/50 p-4 bg-muted/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold border border-primary/20 shrink-0">
              {iniciais}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate leading-tight">{nomeUsuario}</p>
              <p className="text-[11px] text-muted-foreground truncate">Usuário Ativo</p>
            </div>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm" className="w-full justify-center gap-2 text-xs font-semibold h-9 rounded-lg border-muted hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all duration-200">
              <LogOut className="h-3.5 w-3.5" />
              Sair da Conta
            </Button>
          </form>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-y-auto p-4 pb-28 md:p-8 md:pb-8 animate-fade-in">
        <div className="max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* Navegação inferior — celular */}
      <MobileNav />

      {session?.user?.id && (
        <Suspense fallback={null}>
          <VerificarAcesso usuarioId={session.user.id} />
        </Suspense>
      )}
    </div>
  );
}
