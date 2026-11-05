"use client";

import { useEffect, useRef, useState } from "react";
import { MinusIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MIN = 1;
const MAX = 6;

type Vista = { escala: number; x: number; y: number };
const INICIAL: Vista = { escala: 1, x: 0, y: 0 };

function limitar(escala: number) {
  return Math.min(MAX, Math.max(MIN, escala));
}

/**
 * Imagem com zoom: roda do mouse ou pinça (celular) aproxima no ponto
 * apontado, clique duplo alterna 2,5×, arrastar move a foto ampliada.
 */
export function ImagemZoom({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const area = useRef<HTMLDivElement>(null);
  const [vista, setVista] = useState<Vista>(INICIAL);
  // Dedos/mouse apertados agora (para arrastar e pinçar).
  const ponteiros = useRef(new Map<number, { x: number; y: number }>());
  const pinca = useRef<{ distancia: number; vista: Vista } | null>(null);

  /** Muda a escala mantendo parado o ponto (cx, cy) da área, relativo ao centro. */
  function zoomEm(novaEscala: number, cx = 0, cy = 0, base: Vista = vista) {
    const escala = limitar(novaEscala);
    if (escala === MIN) return setVista(INICIAL);
    const fator = escala / base.escala;
    setVista({ escala, x: cx - (cx - base.x) * fator, y: cy - (cy - base.y) * fator });
  }

  function pontoRelativo(clientX: number, clientY: number) {
    const r = area.current!.getBoundingClientRect();
    return { cx: clientX - (r.left + r.width / 2), cy: clientY - (r.top + r.height / 2) };
  }

  function aoRodar(e: WheelEvent) {
    const { cx, cy } = pontoRelativo(e.clientX, e.clientY);
    zoomEm(vista.escala * (e.deltaY < 0 ? 1.2 : 1 / 1.2), cx, cy);
  }

  // A roda precisa de listener nativo não passivo: senão o preventDefault não
  // segura a rolagem do modal. O ref aponta sempre para a versão atual.
  const rodar = useRef(aoRodar);
  useEffect(() => {
    rodar.current = aoRodar;
  });
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ouvinte = (e: WheelEvent) => {
      e.preventDefault();
      rodar.current(e);
    };
    el.addEventListener("wheel", ouvinte, { passive: false });
    return () => el.removeEventListener("wheel", ouvinte);
  }, []);

  function aoApertar(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ponteiros.current.size === 2) {
      const [a, b] = [...ponteiros.current.values()];
      pinca.current = { distancia: Math.hypot(a.x - b.x, a.y - b.y), vista };
    }
  }

  function aoMover(e: React.PointerEvent) {
    const anterior = ponteiros.current.get(e.pointerId);
    if (!anterior) return;
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (ponteiros.current.size === 2 && pinca.current) {
      const [a, b] = [...ponteiros.current.values()];
      const { cx, cy } = pontoRelativo((a.x + b.x) / 2, (a.y + b.y) / 2);
      const distancia = Math.hypot(a.x - b.x, a.y - b.y);
      zoomEm(pinca.current.vista.escala * (distancia / pinca.current.distancia), cx, cy, pinca.current.vista);
      return;
    }
    if (vista.escala > 1) {
      setVista((v) => ({ ...v, x: v.x + e.clientX - anterior.x, y: v.y + e.clientY - anterior.y }));
    }
  }

  function aoSoltar(e: React.PointerEvent) {
    ponteiros.current.delete(e.pointerId);
    if (ponteiros.current.size < 2) pinca.current = null;
  }

  function aoClicarDuasVezes(e: React.MouseEvent) {
    if (vista.escala > 1) return setVista(INICIAL);
    const { cx, cy } = pontoRelativo(e.clientX, e.clientY);
    zoomEm(2.5, cx, cy);
  }

  const ampliada = vista.escala > 1;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        ref={area}
        onPointerDown={aoApertar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        onDoubleClick={aoClicarDuasVezes}
        className={cn(
          "relative flex h-[70vh] touch-none items-center justify-center overflow-hidden rounded-lg bg-muted/40 select-none",
          ampliada ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela nossa rota. */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.escala})` }}
          className="max-h-full max-w-full object-contain transition-transform duration-75 ease-out will-change-transform"
        />
      </div>

      <div className="flex items-center justify-center gap-1">
        <Button type="button" variant="outline" size="icon-sm" onClick={() => zoomEm(vista.escala / 1.5)} disabled={!ampliada} aria-label="Diminuir zoom" title="Diminuir zoom">
          <MinusIcon />
        </Button>
        <span className="w-14 text-center text-xs tabular-nums text-muted-foreground">{Math.round(vista.escala * 100)}%</span>
        <Button type="button" variant="outline" size="icon-sm" onClick={() => zoomEm(vista.escala * 1.5)} disabled={vista.escala >= MAX} aria-label="Aumentar zoom" title="Aumentar zoom">
          <PlusIcon />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setVista(INICIAL)} disabled={!ampliada} aria-label="Voltar ao tamanho normal" title="Voltar ao tamanho normal">
          <RotateCcwIcon />
        </Button>
        <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">Roda do mouse ou clique duplo para dar zoom; arraste para mover.</span>
      </div>
    </div>
  );
}
