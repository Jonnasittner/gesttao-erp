import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/firebase-admin";
import { SidebarNav, MobileNav } from "@/components/navigation";
import { Notificacoes } from "@/components/notificacoes";
import { MenuUsuario } from "@/components/menu-usuario";

// A sessão é um JWT que continua válido mesmo depois de o usuário ser
// removido em Configurações. Ao abrir/recarregar o sistema, confere se ele
// ainda existe e, se não, encerra a sessão. Fica num Suspense próprio para
// não atrasar a exibição da tela.
async function VerificarAcesso({ usuarioId }: { usuarioId: string }) {
  const doc = await db.collection("usuarios").doc(usuarioId).get();
  if (!doc.exists) redirect("/api/sair");
  return null;
}

function Marca({ tamanho = "normal", classeTexto = "" }: { tamanho?: "normal" | "pequena"; classeTexto?: string }) {
  const quadrado = tamanho === "normal" ? "size-9 text-base" : "size-8 text-sm";
  const texto = tamanho === "normal" ? "text-xl" : "text-lg";
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`marca-quadrado flex ${quadrado} shrink-0 items-center justify-center rounded-xl font-bold text-white`}
        aria-hidden
      >
        G
      </span>
      <span className={`texto-marca font-bold tracking-tight ${texto} ${classeTexto}`}>Gesttão</span>
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
        <div className="flex items-center gap-1">
          <Notificacoes em="celular" />
          <MenuUsuario nome={nomeUsuario} email={email} iniciais={iniciais} />
        </div>
      </header>

      {/* Barra lateral — computador. Recolhida só com os ícones; ao passar o
          mouse (ou navegar pelo teclado) abre por cima do conteúdo, sem empurrá-lo. */}
      <aside className="group/sidebar sticky top-0 z-40 hidden h-screen w-[4.5rem] shrink-0 md:block">
        <div className="absolute inset-y-0 left-0 flex w-[4.5rem] flex-col overflow-hidden border-r bg-sidebar transition-[width,box-shadow] duration-200 ease-out group-has-focus-visible/sidebar:w-[17rem] group-has-focus-visible/sidebar:shadow-2xl group-hover/sidebar:w-[17rem] group-hover/sidebar:shadow-2xl">
          <div className="px-[1.125rem] py-5">
            <Marca classeTexto="whitespace-nowrap opacity-0 transition-opacity duration-200 group-has-focus-visible/sidebar:opacity-100 group-hover/sidebar:opacity-100" />
          </div>

          <div className="flex-1 overflow-x-hidden overflow-y-auto pb-4 [scrollbar-width:none]">
            <SidebarNav />
          </div>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="fundo-conteudo flex-1 overflow-y-auto p-4 pb-28 md:px-8 md:pt-0 md:pb-10">
        {/* Linha do topo — computador (no celular fica no cabeçalho): notificações e usuário */}
        <div className="sticky top-0 z-20 -mx-8 mb-6 hidden h-14 items-center justify-end gap-1 border-b bg-background/70 px-8 backdrop-blur-lg md:flex">
          <Notificacoes em="computador" />
          <MenuUsuario nome={nomeUsuario} email={email} iniciais={iniciais} />
        </div>
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
