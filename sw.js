// Bump this version and update SHELL whenever a deployed app asset changes.
const CACHE = 'bir-eki-ush-shell-v1';
const PREFIX = 'bir-eki-ush-shell-';
const ROOT = new URL('./', self.location.href);
const SHELL = [
  './', 'index.html', 'style.css?v=7', 'app.mjs?v=7', 'game.mjs?v=4',
  'analytics.mjs?v=1', 'analytics-config.mjs?v=2', 'pwa.mjs?v=1',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];
const assets = new Map(SHELL.map(path => {
  const url = new URL(path, ROOT);
  return [url.pathname, url.href];
}));

self.addEventListener('install', event => {
  // Atomic precache: an incomplete download must not replace a working version.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(
    SHELL.map(path => new Request(new URL(path, ROOT), { cache: 'reload' })),
  )));
  // Updates wait for the player's explicit action, never interrupting a game.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  // Never intercept analytics, WhatsApp or unrelated files on this GitHub origin.
  const isHome = request.mode === 'navigate' && [ROOT.pathname, new URL('index.html', ROOT).pathname].includes(url.pathname);
  const asset = isHome ? new URL('index.html', ROOT).href : assets.get(url.pathname);
  if (!asset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(asset);
    if (cached) return cached;
    return fetch(request);
  })());
});
