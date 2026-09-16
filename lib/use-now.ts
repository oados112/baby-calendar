"use client";

import { useSyncExternalStore } from "react";

/**
 * שעון אחד משותף לכל האתר.
 *
 * למה לא setInterval בכל רכיב: במסך הבית יש עשרות "לפני X דקות" בו-זמנית.
 * טיימר לכל אחד מהם גורם לעשרות רינדורים לא מסונכרנים ומרוקן סוללה.
 * כאן יש טיק אחד לכל הדף, וכל מי שנרשם אליו מתעדכן יחד.
 *
 * במהלך SSR אין שעון — מוחזר null, והרכיב מציג מציין מקום עד להידרציה.
 */

const TICK_MS = 30_000;

let current = Date.now();
let interval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function start() {
  if (interval) return;
  interval = setInterval(() => {
    current = Date.now();
    for (const l of listeners) l();
  }, TICK_MS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();

  // חזרה ללשונית אחרי זמן: מרעננים מיד, אחרת הזמן "תקוע"
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      current = Date.now();
      for (const l of listeners) l();
    }
  };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    listeners.delete(listener);
    document.removeEventListener("visibilitychange", onVisible);
    if (listeners.size === 0 && interval) {
      clearInterval(interval);
      interval = null;
    }
  };
}

const getSnapshot = () => current;
const getServerSnapshot = () => null;

/** מחזיר את "עכשיו", מתעדכן כל 30 שניות. null עד לסיום ההידרציה. */
export function useNow(): Date | null {
  const ms = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return ms === null ? null : new Date(ms);
}
