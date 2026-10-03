const CACHE = 'observatory-v2';
const BASE = new URL('./', self.location.href);
const ASSETS = ['./', 'index.html', 'app.js', 'style.css', 'icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'data/edition.json'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(p => new URL(p, BASE).href))).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('observatory-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  const key = new URL(url); key.search = '';
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && response.type === 'basic') { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(key.href, copy))); }
    return response;
  }).catch(async () => {
    const cached = (await caches.match(key.href)) || (event.request.mode === 'navigate' ? await caches.match(BASE.href) : null);
    if (!cached) return new Response('Offline and not cached', {status:503});
    const headers = new Headers(cached.headers);
    headers.set('X-Observatory-Cached', 'true');
    return new Response(cached.body, {status:cached.status, statusText:cached.statusText, headers});
  }));
});
