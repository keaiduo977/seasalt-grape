// 海盐葡萄 Service Worker
const CACHE = 'seasalt-v5';
const ASSETS = ['./', './index.html', './app.js', './manifest.json', './icon.png', './icon-192.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 跨域请求（如 DeepSeek API）不缓存
  if (url.origin !== self.location.origin) return;
  // 动态数据（剧集/热搜 json）走 network-first，确保刷新能拿到 GitHub 最新文件
  if (url.pathname.endsWith('.json')) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }
  // 静态资源 cache-first（带缓存兜底）
  e.respondWith(
    caches.match(req).then(cached => {
      const fetcher = fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || fetcher;
    })
  );
});

// 通知点击
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window'}).then(cls => {
    for (const c of cls) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow('./');
  }));
});
