/* 함께 보는 무대 — 오프라인 길안내용 서비스워커
 * 공연날 공연장 주변은 통신이 자주 끊긴다. 한 번 연 화면과 앱 코드(경로 계산 데이터 포함)를 저장해
 * 인터넷 없이도 저장한 길의 '안내 시작'이 되게 한다. */
const VERSION = "ts-v1";
const SHELL = ["/", "/route", "/card", "/seats", "/manifest.webmanifest", "/icon.svg", "/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 화면에서 '저장' 버튼을 누르면 지정한 주소를 바로 저장
self.addEventListener("message", (e) => {
  if (e.data?.type !== "cache-urls") return;
  e.waitUntil(
    caches.open(VERSION).then((c) =>
      Promise.allSettled((e.data.urls || []).map((u) => c.add(new Request(u, { cache: "reload" })))).then((r) => {
        const ok = r.filter((x) => x.status === "fulfilled").length;
        e.source?.postMessage({ type: "cached", ok, total: r.length });
      }),
    ),
  );
});

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/models/") ||
  url.pathname.startsWith("/tour/") ||
  /\.(?:woff2?|png|svg|webp|jpg|glb|css|js)$/.test(url.pathname);

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // 실시간 값은 저장하지 않음

  // 앱 코드·이미지·3D: 저장본 먼저, 뒤에서 새로 받아 갱신
  if (isStatic(url)) {
    e.respondWith(
      caches.open(VERSION).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req)
          .then((res) => {
            if (res.ok) c.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || net;
      }),
    );
    return;
  }

  // 화면(HTML·RSC): 인터넷 먼저(4초), 안 되면 저장본
  e.respondWith(
    caches.open(VERSION).then(async (c) => {
      try {
        const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000))]);
        if (res.ok && req.mode === "navigate") c.put(url.pathname, res.clone());
        return res;
      } catch {
        const hit = (await c.match(req, { ignoreSearch: true })) || (await c.match(url.pathname));
        if (hit) return hit;
        if (req.mode === "navigate") return (await c.match("/route")) || (await c.match("/"));
        return Response.error();
      }
    }),
  );
});
