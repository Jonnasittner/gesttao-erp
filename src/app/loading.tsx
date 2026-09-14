// Mostrado na hora em que o usuário clica para trocar de tela, enquanto o
// servidor busca os dados. Sem este arquivo o Next não pré-carrega as telas
// dinâmicas e a navegação fica "parada" até a resposta chegar. Fica fora do
// layout, então o menu lateral continua visível e clicável.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-busy="true" aria-label="Carregando">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-56 rounded-lg bg-muted" />
        <div className="h-4 w-80 max-w-full rounded-md bg-muted/70" />
      </div>

      <div className="h-16 rounded-2xl border border-muted bg-card" />

      <div className="flex flex-col gap-3 rounded-2xl border border-muted bg-card p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-muted/60" />
        ))}
      </div>
    </div>
  );
}
