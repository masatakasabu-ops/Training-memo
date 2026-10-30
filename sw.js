// 電波がなくてもアプリを開けるようにする（トレーニング・ルート図の両方）。
// ・アプリのファイル：まずネットから。山の中の弱い電波で待たされないよう、3秒で保存した分に切り替える
// ・フォントとライブラリ：版が決まっているので、保存した分を優先
// ・Intervals.icu から読んだ記録や予定：まずネットから。つながらなければ最後に読んだ内容を出す
const APP = "app-v1", LIB = "lib-v1", DATA = "data-v1";
const CORE = ["./", "memo.html", "route/", "apple-touch-icon.png", "route/apple-touch-icon.png"];
const LIBS = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js",
  "https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&family=JetBrains+Mono:wght@500;700&display=swap",
];
const DATA_MAX = 80;   // 日付ごとに URL が変わるので、古いものから捨てる

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    await (await caches.open(APP)).addAll(CORE.map(u => new Request(u, { cache: "reload" })));
    const lib = await caches.open(LIB);
    await Promise.all(LIBS.map(async u => {
      try { const r = await fetch(u, { mode: u.includes("fonts.googleapis") ? "no-cors" : "cors" }); await lib.put(u, r); } catch {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (![APP, LIB, DATA].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.origin === location.origin) e.respondWith(networkFirst(req, APP, 3000));
  else if (/^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)$/.test(url.hostname)) e.respondWith(cacheFirst(req));
  else if (url.hostname === "intervals.icu") e.respondWith(networkFirst(req, DATA, 6000));
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") (await caches.open(LIB)).put(req, res.clone());
  return res;
}

async function networkFirst(req, name, wait) {
  const cache = await caches.open(name);
  const net = fetch(req).then(async res => {
    if (res.ok) {
      await cache.put(req, res.clone());
      if (name === DATA) { const keys = await cache.keys(); for (const k of keys.slice(0, Math.max(0, keys.length - DATA_MAX))) await cache.delete(k); }
    }
    return res;
  });
  net.catch(() => {});   // 保存した分を先に返したあとで失敗しても、エラーにしない
  const hit = cache.match(req, { ignoreSearch: name === APP });
  // 先に返ってきた方を使う。時間切れでも保存した分がなければ、ネットを待つ
  const timer = new Promise(r => setTimeout(r, wait));
  try {
    const first = await Promise.race([net, timer.then(() => hit)]);
    if (first) return first;
    return await net;
  } catch {
    const h = await hit;
    if (h) return h;
    throw new Error("offline");
  }
}
