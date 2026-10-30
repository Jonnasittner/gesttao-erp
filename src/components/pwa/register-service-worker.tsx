"use client";

import { useEffect } from "react";
import { ehErroDeVersaoAntiga, recarregarUmaVez } from "@/lib/versao-antiga";

export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Aba aberta durante um deploy: recarrega para pegar a versão nova.
    const aoRejeitar = (e: PromiseRejectionEvent) => {
      if (ehErroDeVersaoAntiga(e.reason)) recarregarUmaVez();
    };
    const aoErro = (e: ErrorEvent) => {
      if (ehErroDeVersaoAntiga(e.error ?? e.message)) recarregarUmaVez();
    };
    window.addEventListener("unhandledrejection", aoRejeitar);
    window.addEventListener("error", aoErro);
    return () => {
      window.removeEventListener("unhandledrejection", aoRejeitar);
      window.removeEventListener("error", aoErro);
    };
  }, []);

  return null;
}
