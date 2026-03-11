const CACHE = 'sebastian-v1'
const SHELL = ['/mobile/', '/mobile/app.js', '/mobile/style.css', '/mobile/manifest.json']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  // Never cache SSE or API calls
  if (url.pathname.startsWith('/mobile/events') || e.request.method === 'POST') return
  if (url.pathname.startsWith('/mobile/sessions') || url.pathname.startsWith('/mobile/approvals') || url.pathname.startsWith('/mobile/settings')) return

  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})
