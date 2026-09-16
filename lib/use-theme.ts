"use client";

import { useSyncExternalStore } from "react";
import {
  isNightHour,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemeName,
  type ThemePreference,
} from "@/lib/theme";

/**
 * העדפת ערכת הנושא של המשתמש.
 *
 * ההעדפה נשמרת במכשיר ולא בחשבון — בכוונה: הטלפון שמונח ליד המיטה
 * בלילה והמחשב ביום הם מכשירים שונים עם צרכים שונים.
 *
 * במצב "אוטומטי" הערכה נגזרת מהשעה ומהעדפת המערכת, ומתעדכנת מעצמה
 * כשנכנס הלילה — גם אם הדף נשאר פתוח.
 */

const listeners = new Set<() => void>();
let cached: ThemePreference = "auto";
let started = false;

function readStored(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "night" || value === "auto") {
      return value;
    }
  } catch {
    // דפדפן שחוסם אחסון — נשארים על ברירת המחדל
  }
  return "auto";
}

function currentTheme(pref: ThemePreference): ThemeName {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  return resolveTheme(pref, { prefersDark, isNight: isNightHour() });
}

function apply(pref: ThemePreference) {
  document.documentElement.setAttribute("data-theme", currentTheme(pref));
}

function notify() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (!started) {
    started = true;
    cached = readStored();

    // במצב אוטומטי — בדיקה תקופתית, כדי שהמעבר ללילה יקרה גם בדף פתוח
    setInterval(() => {
      if (cached === "auto") apply(cached);
    }, 60_000);

    // שינוי במכשיר אחר באותו דפדפן, או שינוי בהעדפת המערכת
    window.addEventListener("storage", (e) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      cached = readStored();
      apply(cached);
      notify();
    });

    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (cached === "auto") apply(cached);
      });
  }

  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): ThemePreference => cached;
const getServerSnapshot = (): ThemePreference => "auto";

export function useThemePreference(): [
  ThemePreference,
  (next: ThemePreference) => void,
] {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const set = (next: ThemePreference) => {
    cached = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // גם בלי שמירה, השינוי חל על הפעלה הנוכחית
    }
    apply(next);
    notify();
  };

  return [preference, set];
}

/** מה מוצג בפועל כרגע — לתצוגה בלבד. */
export function describeResolved(pref: ThemePreference): string {
  if (pref !== "auto") return "";
  if (typeof window === "undefined") return "";
  return currentTheme("auto") === "night"
    ? "כרגע: לילה"
    : currentTheme("auto") === "dark"
      ? "כרגע: ערב"
      : "כרגע: יום";
}
