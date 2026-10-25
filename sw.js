'use strict';
// 離線快取：HTML 走「網路優先」（有網拿最新版），其餘「快取優先」。
// 記帳 API 在 script.google.com，跨網域的 POST 不經過這裡。
// 改版時把 VER +1，並和 index.html 的 APP_VERSION 一起改（push_deploy.js 會檢查）。
const VER = 1;
const CACHE = 'ledger-v' + VER;
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    // cache:'reload' 繞過 HTTP 快取（GitHub Pages 的 max-age=600），裝進去的一定是這一版
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isHtml = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHtml) {
    e.respondWith(
      // 一定要用 cache:'reload'：單純 fetch(req) 會吃 HTTP 快取，network-first 形同虛設
      fetch(new Request(req.url, { cache: 'reload', credentials: 'same-origin' }))
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
  } else {
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }))
    );
  }
});
