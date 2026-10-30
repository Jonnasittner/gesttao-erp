"use client";

import { useEffect } from "react";
import { ehErroDeVersaoAntiga, recarregarUmaVez } from "@/lib/versao-antiga";

// Erro que derrubou a página inteira (substitui o layout raiz, por isso tem
// <html> e <body> e estilos próprios). O caso mais comum é a aba ter ficado
// aberta durante um deploy: aí recarrega sozinha para pegar a versão nova.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const versaoAntiga = ehErroDeVersaoAntiga(error);

  useEffect(() => {
    if (versaoAntiga) recarregarUmaVez();
  }, [versaoAntiga]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f6f7fb",
          color: "#1f2333",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>
            {versaoAntiga ? "O sistema foi atualizado" : "Não foi possível carregar a página"}
          </h1>
          <p style={{ fontSize: 14, color: "#5b6070", margin: "0 0 20px" }}>
            {versaoAntiga
              ? "Recarregando para abrir a versão nova…"
              : "Aconteceu um erro no servidor. Tente de novo; se continuar, avise quem cuida do sistema."}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: "none",
                background: "#4f5bd5",
                color: "#fff",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Recarregar
            </button>
            {!versaoAntiga && (
              <button
                type="button"
                onClick={() => retry()}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "1px solid #d5d8e3",
                  background: "#fff",
                  color: "#1f2333",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Tentar de novo
              </button>
            )}
          </div>
          {error.digest && <p style={{ fontSize: 11, color: "#9aa0ad", marginTop: 16 }}>Código: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
