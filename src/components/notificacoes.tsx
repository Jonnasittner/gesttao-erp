"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Globe } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listarNotificacoes, marcarNotificacoesLidas } from "@/server/notificacoes";
import type { Notificacao } from "@/lib/notificacoes";
import { formatarDataHoraSegundos } from "@/lib/datetime";
import { cn } from "@/lib/utils";

// Confere a cada 30 s se chegou algo novo (ex.: boleto pago avisado pelo Asaas).
const INTERVALO_MS = 30_000;

export function Notificacoes() {
  const [lista, setLista] = useState<Notificacao[]>([]);
  const [aberto, setAberto] = useState(false);

  const carregar = useCallback(async () => {
    const resultado = await listarNotificacoes().catch(() => null);
    if (resultado?.ok) setLista(resultado.dados);
  }, []);

  useEffect(() => {
    // Primeira busca fora do corpo do efeito (regra do React sobre setState síncrono).
    const primeira = setTimeout(carregar, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") carregar();
    }, INTERVALO_MS);
    return () => {
      clearTimeout(primeira);
      clearInterval(timer);
    };
  }, [carregar]);

  const naoLidas = lista.filter((n) => !n.lida);

  function alternar(abrir: boolean) {
    setAberto(abrir);
    // Ao abrir, as novas passam a lidas (o destaque some ao fechar).
    if (!abrir && naoLidas.length > 0) {
      setLista((atual) => atual.map((n) => ({ ...n, lida: true })));
    }
    if (abrir && naoLidas.length > 0) {
      marcarNotificacoesLidas(naoLidas.map((n) => n.id)).catch(() => undefined);
    }
  }

  return (
    <Popover open={aberto} onOpenChange={alternar}>
      <PopoverTrigger
        className="relative flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={naoLidas.length ? `${naoLidas.length} notificações novas` : "Notificações"}
        title="Notificações"
      >
        <Globe className={cn("size-5", naoLidas.length > 0 && "text-primary")} />
        {naoLidas.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white ring-2 ring-background">
            {naoLidas.length > 9 ? "9+" : naoLidas.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b px-4 py-3 text-sm font-semibold">Notificações</p>
        {lista.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma notificação.</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {lista.map((n) => (
              <li key={n.id} className="border-b last:border-b-0">
                <Link
                  href={n.link || "#"}
                  onClick={() => alternar(false)}
                  className={cn("flex gap-3 px-4 py-3 transition-colors hover:bg-muted", !n.lida && "bg-primary/5")}
                >
                  <span
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.lida ? "bg-transparent" : "bg-primary")}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{n.titulo}</span>
                    <span className="block text-muted-foreground">{n.mensagem}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground/80">
                      {formatarDataHoraSegundos(n.criadaEm)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
