/**
 * חישובי יום לפי אזור זמן.
 *
 * למה לא פשוט getDate(): על Vercel השרת רץ ב-UTC והדפדפן בישראל. האכלה
 * ב-01:30 הייתה נספרת ליום אחר בכל צד, ובקיץ ההפרש גדול יותר. כאן כל
 * החישובים נשענים על אזור הזמן של המשפחה, כך שהתוצאה זהה בשני הצדדים.
 */

const TZ_CACHE = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = TZ_CACHE.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    TZ_CACHE.set(timeZone, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // חצות מיוצג לפעמים כ-24 ולא כ-0
    hour: get("hour") % 24,
    minute: get("minute"),
  };
}

/** "2026-09-16" — מפתח היום שאליו האירוע שייך. */
export function dayKey(date: Date, timeZone: string): string {
  const { year, month, day } = zonedParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** ההיסט של אזור הזמן ברגע נתון, במילישניות. */
function offsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  // שניות ומילישניות זהות בכל אזור זמן, אז מספיק לדייק עד הדקה
  const rounded = Math.floor(date.getTime() / 60_000) * 60_000;
  return asUtc - rounded;
}

/** תחילת היום וסופו (לא כולל), ב-UTC, עבור מפתח יום נתון. */
export function dayRange(key: string, timeZone: string): { from: Date; to: Date } {
  const [y, m, d] = key.split("-").map(Number);

  // ניחוש ראשוני לפי UTC, ואז תיקון לפי ההיסט באותו תאריך.
  // שתי איטרציות מספיקות גם בלילה של מעבר שעון.
  let guess = Date.UTC(y, m - 1, d, 0, 0);
  for (let i = 0; i < 2; i++) {
    guess = Date.UTC(y, m - 1, d, 0, 0) - offsetMs(new Date(guess), timeZone);
  }

  const from = new Date(guess);
  const to = new Date(guess + 24 * 3600_000);
  return { from, to };
}

/** מפתח היום שלפני/אחרי. */
export function shiftDayKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

/** רשימת מפתחות ימים, מהישן לחדש, המסתיימת ב-endKey. */
export function lastDayKeys(endKey: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    shiftDayKey(endKey, i - (count - 1)),
  );
}

const WEEKDAYS_SHORT = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export function weekdayShort(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return WEEKDAYS_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "16.9" */
export function shortDate(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d}.${m}`;
}

/** "יום רביעי, 16 בספטמבר" */
const MONTHS = [
  "בינואר", "בפברואר", "במרץ", "באפריל", "במאי", "ביוני",
  "ביולי", "באוגוסט", "בספטמבר", "באוקטובר", "בנובמבר", "בדצמבר",
];
const WEEKDAYS_FULL = [
  "ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת",
];

export function longDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const weekday = WEEKDAYS_FULL[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `יום ${weekday}, ${d} ${MONTHS[m - 1]}`;
}
