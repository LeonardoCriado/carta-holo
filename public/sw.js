// Service worker mínimo: cache-first para los assets de la app.
const CACHE = "carta-holo-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/assets/card.png",
  "/assets/cosmos-bottom.png",
  "/assets/cosmos-middle-trans.png",
  "/assets/cosmos-top-trans.png",
  "/assets/glitter.png",
  "/assets/illusion.png",
  "/assets/illusion-mask.png",
  "/assets/vmaxbg.jpg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});
