"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Globe } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listarNotificacoes, marcarNotificacoesLidas } from "@/server/notificacoes";
import type { Notificacao } from "@/lib/notificacoes";
import { formatarDataHoraSegundos } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { ehErroDeVersaoAntiga, recarregarUmaVez } from "@/lib/versao-antiga";

// Confere a cada 60 s se chegou algo novo (ex.: boleto pago avisado pelo
// Asaas). Cada consulta custa leituras no Firestore (cota diária do plano
// gratuito): por isso só pede as notificações mais novas que a última já
// recebida, e só com a aba visível.
const INTERVALO_MS = 60_000;
const MAX_NA_LISTA = 30;

// O planeta aparece no cabeçalho do celular e na barra do computador (um dos
// dois fica escondido pelo CSS); só o que está à vista consulta o servidor.
const MIDIA: Record<"celular" | "computador", string> = {
  celular: "(max-width: 767.98px)",
  computador: "(min-width: 768px)",
};

export function Notificacoes({ em }: { em: "celular" | "computador" }) {
  const [lista, setLista] = useState<Notificacao[]>([]);
  const [aberto, setAberto] = useState(false);
  const maisNova = useRef<string | null>(null);

  const carregar = useCallback(async () => {
    const resultado = await listarNotificacoes(maisNova.current ?? undefined).catch((err) => {
      // Aba aberta durante um deploy: recarrega para pegar a versão nova.
      if (ehErroDeVersaoAntiga(err)) recarregarUmaVez();
      return null;
    });
    if (!resultado?.ok || resultado.dados.length === 0) return;
    const novas = resultado.dados;
    if (novas[0]?.criadaEm) maisNova.current = novas[0].criadaEm;
    setLista((atual) => {
      const ids = new Set(novas.map((n) => n.id));
      return [...novas, ...atual.filter((n) => !ids.has(n.id))].slice(0, MAX_NA_LISTA);
    });
  }, []);

  useEffect(() => {
    if (!window.matchMedia(MIDIA[em]).matches) return;
    // Primeira busca fora do corpo do efeito (regra do React sobre setState síncrono).
    const primeira = setTimeout(carregar, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && window.matchMedia(MIDIA[em]).matches) carregar();
    }, INTERVALO_MS);
    return () => {
      clearTimeout(primeira);
      clearInterval(timer);
    };
  }, [carregar, em]);

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
