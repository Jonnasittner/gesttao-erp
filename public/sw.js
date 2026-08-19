// Service worker mínimo: só existe para o navegador considerar o app
// "instalável" (adicionar à tela inicial) no Android/Chrome. Estratégia
// network-first — sempre tenta a rede primeiro (o app é dinâmico, com
// login e dados ao vivo) e só usa o cache como fallback quando offline.
const CACHE = "gesttao-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copia = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copia)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
