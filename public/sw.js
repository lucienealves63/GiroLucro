/* GiroLucro service worker — mínimo para instalabilidade PWA.
   Dados vivem no servidor (só funcionam online); o SW só garante o shell. */
const CACHE = "girolucro-v1";
const SHELL = ["/manifest.webmanifest", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // nunca intercepta API, auth ou métodos não-GET
  if (event.request.method !== "GET" || url.pathname.startsWith("/api")) return;
  // network-first com fallback ao cache (shell)
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  );
});
