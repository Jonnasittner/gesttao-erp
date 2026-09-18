import { LogOut } from "lucide-react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
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

function Marca({ tamanho = "normal" }: { tamanho?: "normal" | "pequena" }) {
  const quadrado = tamanho === "normal" ? "size-9 text-base" : "size-8 text-sm";
  const texto = tamanho === "normal" ? "text-xl" : "text-lg";
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`marca-quadrado flex ${quadrado} items-center justify-center rounded-xl font-bold text-white`}
        aria-hidden
      >
        G
      </span>
      <span className={`texto-marca font-bold tracking-tight ${texto}`}>Gesttão</span>
    </span>
  );
}

function Avatar({ iniciais }: { iniciais: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/15">
      {iniciais}
    </span>
  );
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const nomeUsuario = session?.user?.name ?? session?.user?.email ?? "";
  const email = session?.user?.email ?? "";

  const iniciais =
    nomeUsuario
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "U";

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      {/* Cabeçalho — celular */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur-lg md:hidden">
        <Marca tamanho="pequena" />
        <div className="flex items-center gap-2">
          <Avatar iniciais={iniciais} />
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Sair (${nomeUsuario})`}
            >
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      </header>

      {/* Barra lateral — computador */}
      <aside className="sticky top-0 hidden h-screen w-[17rem] shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="px-5 py-5">
          <Marca />
        </div>

        <div className="flex-1 overflow-y-auto pb-4">
          <SidebarNav />
        </div>

        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar iniciais={iniciais} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{nomeUsuario}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="mt-1 w-full justify-start gap-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-4" />
              Sair da conta
            </Button>
          </form>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="fundo-conteudo flex-1 overflow-y-auto p-4 pb-28 md:p-8 md:pb-10">
        <div className="mx-auto w-full max-w-7xl animate-fade-in">{children}</div>
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
