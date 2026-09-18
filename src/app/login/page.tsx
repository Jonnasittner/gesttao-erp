import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/server/auth-actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="fundo-conteudo flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span
            className="marca-quadrado flex size-12 items-center justify-center rounded-2xl text-lg font-bold text-white"
            aria-hidden
          >
            G
          </span>
          <div>
            <h1 className="texto-marca text-3xl font-bold tracking-tight">Gesttão</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Orçamentos, pedidos, agenda e financeiro num lugar só.
            </p>
          </div>
        </div>

        <div className="superficie sombra-alta p-6">
          <form action={loginAction} className="flex flex-col gap-4">
            <input type="hidden" name="callbackUrl" value={params.callbackUrl ?? "/agendamentos"} />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                className="h-10"
                placeholder="nome@exemplo.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                name="senha"
                type="password"
                required
                autoComplete="current-password"
                className="h-10"
                placeholder="••••••••"
              />
            </div>

            {params.error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                E-mail ou senha inválidos.
              </p>
            )}

            <Button type="submit" size="lg" className="mt-1 h-10 w-full">
              Entrar
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Acesso restrito à equipe. Esqueceu a senha? Peça para alguém com acesso trocar em Configurações.
        </p>
      </div>
    </div>
  );
}
