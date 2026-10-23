"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarIcon, UnplugIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { desconectarGoogleCalendar, type StatusGoogleCalendar } from "@/server/google-calendar";
import { formatarDataHora } from "@/lib/datetime";

const MENSAGENS_RETORNO: Record<string, () => void> = {
  conectado: () =>
    toast.success("Google Calendar conectado. Os agendamentos existentes estão sendo enviados para a agenda."),
  cancelado: () => toast.info("Conexão com o Google cancelada."),
  erro: () => toast.error("Não foi possível conectar ao Google. Tente de novo."),
  "sem-permissao-agenda": () =>
    toast.error(
      "O Google não liberou acesso à agenda. Conecte de novo e marque a caixa de ver e editar eventos.",
      { duration: 10_000 }
    ),
  "sem-credenciais": () =>
    toast.error("Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env antes de conectar."),
};

export function GoogleCalendarSecao({ status }: { status: StatusGoogleCalendar }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Mostra o resultado da volta do Google (/configuracoes?google=...) e limpa a URL.
  useEffect(() => {
    const resultado = new URLSearchParams(window.location.search).get("google");
    if (!resultado) return;
    MENSAGENS_RETORNO[resultado]?.();
    router.replace("/configuracoes", { scroll: false });
  }, [router]);

  function desconectar() {
    if (!confirm("Desconectar o Google Calendar? Os eventos já criados continuam na agenda do Google.")) return;
    startTransition(async () => {
      try {
        await desconectarGoogleCalendar();
        toast.success("Google Calendar desconectado.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao desconectar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <CalendarIcon className="h-4 w-4 text-primary" />
            Google Calendar
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os agendamentos da equipe vão sozinhos para a agenda da conta Google conectada aqui.
          </p>
        </div>
        {status.conectado ? (
          <Badge variant="secondary">Conectado</Badge>
        ) : (
          <Badge variant="outline">Desconectado</Badge>
        )}
      </div>

      {!status.configurado ? (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Falta configurar as credenciais do Google: defina <code>GOOGLE_CLIENT_ID</code> e{" "}
          <code>GOOGLE_CLIENT_SECRET</code> no <code>.env</code> (veja o <code>.env.example</code>) e
          reinicie o servidor.
        </p>
      ) : status.conectado ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Conta: <span className="font-medium">{status.email || "(e-mail não informado)"}</span>
            {status.conectadoEm && (
              <span className="text-muted-foreground">
                {" "}
                · conectada em {formatarDataHora(status.conectadoEm)}
                {status.conectadoPor && ` por ${status.conectadoPor}`}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={desconectar} disabled={isPending} className="gap-1.5">
              <UnplugIcon className="h-4 w-4" />
              Desconectar
            </Button>
          </div>
        </div>
      ) : (
        <div>
          {/* Link comum (não <Link>): a rota redireciona para fora do app, para o Google. */}
          <Button size="sm" nativeButton={false} render={<a href="/api/google-calendar/conectar" />} className="gap-1.5">
            <CalendarIcon className="h-4 w-4" />
            Conectar conta Google
          </Button>
        </div>
      )}
    </div>
  );
}
