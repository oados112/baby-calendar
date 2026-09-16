/**
 * Service Worker.
 *
 * שתי מטרות בשלב הזה:
 *  1. שהאתר ייפתח גם בלי רשת ולא יראה "אין חיבור" — קריטי בחדר לידה,
 *     במעלית, או בכל מקום שבו הקליטה נופלת בדיוק כשצריך לרשום.
 *  2. תשתית להתראות פוש בהמשך.
 *
 * אסטרטגיה:
 *  • ניווטים: קודם רשת, ואם נכשלה — הדף השמור. אף פעם לא ההפך, כדי שלא
 *    יוצג מידע ישן כשיש חיבור תקין.
 *  • קבצים סטטיים של Next (immutable, עם hash בשם): קודם המטמון.
 *  • בקשות ל-API ול-Supabase: רשת בלבד, אף פעם לא מהמטמון.
 */

const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll([OFFLINE_URL]);
      // גרסה חדשה נכנסת לתוקף מיד ולא ממתינה לסגירת כל הלשוניות
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isSupabase(url) {
  return url.hostname.endsWith(".supabase.co");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isSupabase(url)) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (
            (await cache.match(OFFLINE_URL)) ??
            new Response("אין חיבור", {
              status: 503,
              headers: { "content-type": "text/plain; charset=utf-8" },
            })
          );
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })(),
    );
  }
});

/** התראות פוש — המנגנון המלא ייבנה בשלב ההתראות. */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "היומן של התינוק", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "היומן של התינוק", {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      dir: "rtl",
      lang: "he",
      tag: payload.tag,
      renotify: Boolean(payload.tag),
      data: { url: payload.url ?? "/" },
      actions: payload.actions ?? [],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // אם האתר כבר פתוח — מתמקדים בו במקום לפתוח לשונית נוספת
      for (const client of windows) {
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
