"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * הרשמה להתראות פוש.
 *
 * ההרשמה היא פר-מכשיר ולא פר-חשבון: אותו הורה יכול לרצות התראות
 * בטלפון אבל לא במחשב שבעבודה.
 */

export type PushSupport =
  | "ready" // אפשר לבקש הרשאה
  | "granted" // כבר אושר
  | "denied" // המשתמש חסם — צריך לשנות בהגדרות הדפדפן
  | "needs-install" // אייפון: חובה "הוסף למסך הבית" קודם
  | "unsupported";

/** האם האתר רץ כאפליקציה מותקנת (מסך הבית) ולא בלשונית דפדפן. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari לא תומך ב-display-mode ומשתמש בדגל משלו
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // אייפד מודרני מדווח על עצמו כ-Mac עם מסך מגע
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    // באייפון זה בדיוק המצב כל עוד האתר פתוח בלשונית ולא הותקן
    return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  }
  if (!("Notification" in window)) return "unsupported";

  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  if (isIos() && !isStandalone()) return "needs-install";
  return "ready";
}

/** המפתח הציבורי מגיע כ-base64url וצריך להישלח כבייטים. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * מבקש הרשאה, נרשם אצל ספק הפוש של הדפדפן, ושומר את המנוי.
 * מחזיר הודעת שגיאה קריאה, או null אם הצליח.
 */
export async function enablePush(userId: string): Promise<string | null> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return "ההתראות עדיין לא הוגדרו בשרת";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return "ההרשאה לא ניתנה. אפשר לשנות את זה בהגדרות הדפדפן.";
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // מנוי קיים עשוי להיות של מפתח ישן — מסירים ונרשמים מחדש
    const existing = await registration.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    const json = subscription.toJSON();
    if (!json.keys?.p256dh || !json.keys?.auth) {
      return "הדפדפן לא החזיר מפתחות תקינים";
    }

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 200),
        fail_count: 0,
      },
      { onConflict: "endpoint" },
    );

    if (error) return error.message;
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "ההרשמה להתראות נכשלה";
  }
}

/** מבטל את ההתראות במכשיר הזה בלבד. */
export async function disablePush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  const supabase = getSupabaseBrowserClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

/** האם המכשיר הזה כבר רשום. */
export async function isSubscribed(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    return Boolean(await registration.pushManager.getSubscription());
  } catch {
    return false;
  }
}

/**
 * מצב התמיכה כמקור חיצוני.
 *
 * הרשאת ההתראות היא מצב של הדפדפן ולא של הרכיב, ולכן היא נקראת דרך
 * useSyncExternalStore ולא נכתבת ל-state בתוך effect. refreshPushSupport
 * מודיע על שינוי אחרי שהמשתמש אישר או ביטל.
 */
const supportListeners = new Set<() => void>();

function subscribeSupport(listener: () => void) {
  supportListeners.add(listener);
  return () => supportListeners.delete(listener);
}

export function refreshPushSupport() {
  for (const listener of supportListeners) listener();
}

export function subscribeToPushSupport(listener: () => void) {
  return subscribeSupport(listener);
}

export const readPushSupport = (): PushSupport => getPushSupport();
export const readPushSupportOnServer = (): PushSupport | null => null;
