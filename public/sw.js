/* GiroLucro service worker — PWA + Web Push. */
const CACHE = "girolucro-v2";
const SHELL = ["/manifest.webmanifest", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.pathname.startsWith("/api")) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "Você tem um novo lembrete." };
  }

  const options = {
    body: payload.body || "Abra o GiroLucro para conferir.",
    icon: payload.icon || "/icons/icon-512.png",
    badge: payload.badge || "/icons/icon-512.png",
    tag: payload.tag || "girolucro",
    renotify: true,
    requireInteraction: payload.requireInteraction === true,
    actions: payload.actions || [],
    data: { url: payload.url || "/" },
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || "GiroLucro", options),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(destination);
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(destination) : undefined;
    }),
  );
});
