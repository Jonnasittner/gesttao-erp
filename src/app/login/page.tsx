import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="flex min-h-screen items-center justify-center bg-mesh-gradient px-4 relative overflow-hidden">
      {/* Decorative glowing blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-accent-foreground/20 rounded-full blur-3xl" />

      <Card className="w-full max-w-sm glass-card border border-white/20 dark:border-white/10 shadow-2xl relative z-10 animate-fade-in">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
            Gesttão
          </CardTitle>
          <CardDescription className="text-muted-foreground mt-1">
            Entre com seu e-mail e senha para acessar o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-4">
          <form action={loginAction} className="flex flex-col gap-4">
            <input type="hidden" name="callbackUrl" value={params.callbackUrl ?? "/agendamentos"} />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                className="bg-background/50 border-muted focus:bg-background transition-all"
                placeholder="nome@exemplo.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="senha" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Senha</Label>
              <Input
                id="senha"
                name="senha"
                type="password"
                required
                className="bg-background/50 border-muted focus:bg-background transition-all"
                placeholder="••••••••"
              />
            </div>

            {params.error && (
              <p className="text-sm text-destructive font-medium animate-pulse">E-mail ou senha inválidos.</p>
            )}

            <Button type="submit" className="w-full h-10 mt-2 bg-gradient-to-r from-primary to-[oklch(0.50_0.20_280)] hover:from-primary/95 hover:to-[oklch(0.50_0.20_280)]/95 shadow-md hover:shadow-lg text-primary-foreground hover:scale-[1.01] active:scale-[0.99] transition-all duration-200">
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
