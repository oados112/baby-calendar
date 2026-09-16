/**
 * ניהול ערכות נושא.
 *
 * שלוש ערכות: light / dark / night.
 * "night" היא מסך שחור אמיתי בגוונים חמים — לשימוש בהאכלות לילה.
 *
 * העדפת המשתמש: auto (ברירת מחדל) | light | dark | night
 * ב-auto: שעות הלילה → night, אחרת לפי העדפת המערכת.
 */

export type ThemeName = "light" | "dark" | "night";
export type ThemePreference = "auto" | ThemeName;

export const THEME_STORAGE_KEY = "bc:theme";

/** שעת התחלה וסיום של מצב לילה אוטומטי (שעון מקומי). */
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 6;

export function isNightHour(date: Date = new Date()): boolean {
  const h = date.getHours();
  return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR;
}

export function resolveTheme(
  preference: ThemePreference,
  opts: { prefersDark: boolean; isNight: boolean },
): ThemeName {
  if (preference !== "auto") return preference;
  if (opts.isNight) return "night";
  return opts.prefersDark ? "dark" : "light";
}

/**
 * סקריפט שרץ ב-<head> לפני הציור הראשון.
 * חייב להיות עצמאי — הוא מוזרק כמחרוזת ולא עובר bundling.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var pref = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}) || "auto";
    var theme = pref;
    if (pref === "auto") {
      var h = new Date().getHours();
      var night = h >= ${NIGHT_START_HOUR} || h < ${NIGHT_END_HOUR};
      if (night) {
        theme = "night";
      } else {
        theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
    }
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`.trim();
