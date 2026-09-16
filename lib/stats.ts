import { dayKey } from "@/lib/zoned";
import type { EventRow, EventType } from "@/types/db";

/**
 * צבירת נתונים לתצוגות היומית והשבועית.
 *
 * הכל פונקציות טהורות שמקבלות אזור זמן — אותה קלט תמיד נותן אותה תוצאה
 * בשרת ובדפדפן, כך שאין אי-התאמה בהידרציה ואין תלות בשעון של המכשיר.
 */

const FEED_TYPES: EventType[] = ["feed_breast", "feed_bottle", "solids"];

export interface DaySummary {
  key: string;
  feeds: number;
  bottleMl: number;
  breastMinutes: number;
  sleepMinutes: number;
  longestSleepMinutes: number;
  diapers: number;
  pee: number;
  poo: number;
}

function emptyDay(key: string): DaySummary {
  return {
    key,
    feeds: 0,
    bottleMl: 0,
    breastMinutes: 0,
    sleepMinutes: 0,
    longestSleepMinutes: 0,
    diapers: 0,
    pee: 0,
    poo: 0,
  };
}

function minutesBetween(a: string, b: string): number {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 60_000);
}

/**
 * סיכום לכל יום.
 *
 * שינה נספרת ליום שבו היא התחילה. זה מכוון: שנת לילה שמתחילה ב-23:40
 * שייכת בתחושה לאותו ערב, ולא "נחתכת" בחצות לשני ימים.
 */
export function summarizeDays(
  events: EventRow[],
  keys: string[],
  timeZone: string,
): DaySummary[] {
  const byKey = new Map(keys.map((k) => [k, emptyDay(k)]));

  for (const e of events) {
    if (e.deleted_at) continue;
    const key = dayKey(new Date(e.started_at), timeZone);
    const day = byKey.get(key);
    if (!day) continue;

    const data = (e.data ?? {}) as Record<string, unknown>;

    if (FEED_TYPES.includes(e.type)) {
      day.feeds += 1;
      if (e.type === "feed_bottle" && typeof data.amount_ml === "number") {
        day.bottleMl += data.amount_ml;
      }
      if (e.type === "feed_breast") {
        const left = typeof data.left_sec === "number" ? data.left_sec : 0;
        const right = typeof data.right_sec === "number" ? data.right_sec : 0;
        day.breastMinutes += Math.round((left + right) / 60);
      }
    }

    if (e.type === "sleep" && e.ended_at) {
      const minutes = minutesBetween(e.started_at, e.ended_at);
      day.sleepMinutes += minutes;
      day.longestSleepMinutes = Math.max(day.longestSleepMinutes, minutes);
    }

    if (e.type === "diaper") {
      day.diapers += 1;
      if (data.pee) day.pee += 1;
      if (data.poo) day.poo += 1;
    }
  }

  return keys.map((k) => byKey.get(k) ?? emptyDay(k));
}

/**
 * מפת שינה: לכל יום, כמה דקות שינה נפלו בכל שעה מ-0 עד 23.
 * זה מה שחושף את הדפוס — מתי באמת ישנים ומתי הלילה מתפרק.
 */
export function sleepHeatmap(
  events: EventRow[],
  keys: string[],
  timeZone: string,
): number[][] {
  const index = new Map(keys.map((k, i) => [k, i]));
  const grid = keys.map(() => new Array(24).fill(0) as number[]);

  for (const e of events) {
    if (e.type !== "sleep" || e.deleted_at || !e.ended_at) continue;

    let cursor = new Date(e.started_at).getTime();
    const end = new Date(e.ended_at).getTime();

    // פורסים את השינה לפי שעות אמיתיות, כדי ששנת לילה תופיע נכון
    // בשני צידי חצות במקום להיערם על שעת ההתחלה
    while (cursor < end) {
      const at = new Date(cursor);
      const key = dayKey(at, timeZone);
      const row = index.get(key);

      const hourStart = new Date(cursor);
      hourStart.setMinutes(0, 0, 0);
      const nextHour = hourStart.getTime() + 3600_000;
      const sliceEnd = Math.min(end, nextHour);

      if (row !== undefined) {
        const hour = Number(
          new Intl.DateTimeFormat("en-GB", {
            timeZone,
            hour: "2-digit",
            hour12: false,
          }).format(at),
        ) % 24;
        grid[row][hour] += (sliceEnd - cursor) / 60_000;
      }

      cursor = sliceEnd;
    }
  }

  return grid;
}

export function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} דק׳`;
  if (m === 0) return `${h} שע׳`;
  return `${h}:${String(m).padStart(2, "0")} שע׳`;
}

/** ממוצע שמתעלם מימים ריקים — אחרת יום שטרם התחיל מוריד את הממוצע. */
export function averageOf(values: number[]): number {
  const real = values.filter((v) => v > 0);
  if (real.length === 0) return 0;
  return real.reduce((a, b) => a + b, 0) / real.length;
}
