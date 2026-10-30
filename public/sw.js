// Service worker mínimo: só existe para o navegador considerar o app
// "instalável" (adicionar à tela inicial) no Android/Chrome.
//
// Não intercepta páginas, dados do Next (RSC) nem chamadas ao servidor: servir
// cópia antiga disso depois de um deploy deixava a tela presa numa versão
// velha ("Server Action ... was not found on the server"). Só os ícones e os
// arquivos estáticos com hash (/_next/static, que nunca mudam) passam por
// aqui, rede primeiro e cache só quando offline.
const CACHE = "gesttao-v2";

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

function podeUsarCache(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|webmanifest)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  // Sem respondWith: o navegador busca normalmente, sem passar pelo cache.
  if (!podeUsarCache(event.request)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copia = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copia)).catch(() => {});
        }
        return response;
      })
      // Offline sem cópia: devolve um erro de rede de verdade (undefined quebra a página).
      .catch(() => caches.match(event.request).then((salva) => salva || Response.error()))
  );
});
