import fs from 'node:fs'
import path from 'node:path'

const dist = path.resolve('dist')
const indexPath = path.join(dist, 'index.html')

if (!fs.existsSync(indexPath)) {
  throw new Error(`Expo web export não gerou ${indexPath}`)
}

const manifest = {
  name: 'Apetit',
  short_name: 'Apetit',
  description: 'Sua alimentação no trabalho, de um jeito simples, seguro e personalizado.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#F7F6F2',
  theme_color: '#F7F6F2',
  icons: [
    { src: '/apetit-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
  ],
}

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#F00646"/>
  <circle cx="256" cy="256" r="162" fill="#07090B" opacity="0.18"/>
  <text x="256" y="306" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="220" font-weight="900" fill="#FFFFFF">A</text>
</svg>`

const sw = `const CACHE = 'apetit-pwa-v2';
const SHELL = ['/', '/manifest.webmanifest', '/apetit-icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match('/'))));
});`

fs.writeFileSync(path.join(dist, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2))
fs.writeFileSync(path.join(dist, 'apetit-icon.svg'), icon)
fs.writeFileSync(path.join(dist, 'sw.js'), sw)

let html = fs.readFileSync(indexPath, 'utf8')
const headAdditions = `
<meta name="theme-color" content="#F7F6F2" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Apetit" />
<meta name="mobile-web-app-capable" content="yes" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" href="/apetit-icon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apetit-icon.svg" />
<meta name="google" content="notranslate" />
<style>
  :root { --apetit-bg:#F7F6F2; color-scheme:light; }
  html, body, #root { background:var(--apetit-bg); height:100%; }
  #root { min-height:100dvh; }
  body { margin:0; overscroll-behavior-y:none; }
  :focus-visible { outline:3px solid #BD2343; outline-offset:3px; }
  input, textarea { font-size:16px; }
  @media (prefers-reduced-motion: reduce) { * { scroll-behavior:auto !important; } }
</style>
<script>
  try {
    if (localStorage.getItem('apetit-appearance-v1') === 'dark') {
      document.documentElement.style.setProperty('--apetit-bg', '#151916');
      document.documentElement.style.colorScheme = 'dark';
      document.querySelector('meta[name="theme-color"]').content = '#151916';
    }
  } catch (_) {}
</script>`

html = html.replace(/<html[^>]*>/i, '<html lang="pt-BR" translate="no">')
html = html.replace('</head>', `${headAdditions}\n</head>`)
html = html.replace('</body>', `<script>if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined)); }</script>\n</body>`)
fs.writeFileSync(indexPath, html)

console.log('Apetit PWA shell gerado em dist/.')
