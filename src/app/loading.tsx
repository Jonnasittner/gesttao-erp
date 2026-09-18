// Mostrado na hora em que o usuário clica para trocar de tela, enquanto o
// servidor busca os dados. Sem este arquivo o Next não pré-carrega as telas
// dinâmicas e a navegação fica "parada" até a resposta chegar. Fica fora do
// layout, então o menu lateral continua visível e clicável.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando">
      <div className="flex flex-col gap-2">
        <div className="esqueleto h-8 w-56 rounded-lg" />
        <div className="esqueleto h-4 w-80 max-w-full rounded-md" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="esqueleto h-24 rounded-xl" />
        ))}
      </div>

      <div className="superficie flex flex-col gap-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="esqueleto h-10 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
