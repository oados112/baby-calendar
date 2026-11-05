import {
  lmsAt,
  MAX_AGE_DAYS,
  type GrowthIndicator,
  type GrowthSex,
} from "@/lib/growth-standards";
import type { EventRow } from "@/types/db";

/**
 * אחוזוני גדילה.
 *
 * **מה זה אומר.** אחוזון 60 במשקל פירושו שמתוך מאה תינוקות בני אותו
 * גיל ואותו מין, שישים שוקלים פחות ממנה. זה *לא* ציון. תינוקת
 * באחוזון 15 שעולה בקצב יציב בריאה בדיוק כמו אחת באחוזון 85; מה
 * שמעניין רופא הוא **שהעקומה נשמרת**, לא המספר עצמו.
 *
 * **מה זה לא.** אין כאן אבחנה ואין סף של "תקין". המסך מציג את מה
 * שנמדד ואת מיקומו בתקן, והפירוש הוא תפקידה של האחות או הרופא.
 *
 * החישוב הוא הנוסחה הרשמית של WHO מתוך L, M ו-S:
 *   z = ((x/M)^L − 1) / (L·S)   ולכשL=0:  z = ln(x/M)/S
 */

export interface GrowthPoint {
  /** מתי נמדד */
  at: string;
  ageDays: number;
  /** בק״ג / ס״מ, כמו אצל WHO */
  value: number;
  z: number;
  percentile: number;
}

/** הפונקציה המצטברת של ההתפלגות הנורמלית. */
function normalCdf(z: number): number {
  // קירוב Abramowitz–Stegun 7.1.26 ל-erf. השגיאה קטנה מ-1.5e-7,
  // כלומר הרבה מתחת לספרה שמוצגת
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;

  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);

  return 0.5 * (1 + sign * y);
}

export function zToPercentile(z: number): number {
  return normalCdf(z) * 100;
}

/** null כשאין תקן לגיל או למין הזה. */
export function growthZ(
  sex: GrowthSex,
  indicator: GrowthIndicator,
  ageDays: number,
  value: number,
): number | null {
  if (!(value > 0)) return null;

  const lms = lmsAt(sex, indicator, ageDays);
  if (!lms) return null;

  const { L, M, S } = lms;
  return Math.abs(L) < 1e-9
    ? Math.log(value / M) / S
    : ((value / M) ** L - 1) / (L * S);
}

/**
 * הערך שמתאים לסטיית תקן נתונה — ההפך של growthZ.
 *
 * משמש לציור רצועות הייחוס: הרצועה של אחוזון 3 עד 97 היא הערך
 * ב-z=−1.881 עד z=+1.881 לכל גיל.
 */
export function valueAtZ(
  sex: GrowthSex,
  indicator: GrowthIndicator,
  ageDays: number,
  z: number,
): number | null {
  const lms = lmsAt(sex, indicator, ageDays);
  if (!lms) return null;

  const { L, M, S } = lms;
  return Math.abs(L) < 1e-9
    ? M * Math.exp(S * z)
    : M * (1 + L * S * z) ** (1 / L);
}

/** ימים מלאים מהלידה עד המדידה. */
export function ageDaysAt(birthDate: string, at: string): number {
  const birth = new Date(`${birthDate.slice(0, 10)}T00:00:00Z`).getTime();
  const when = new Date(`${at.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.floor((when - birth) / 86_400_000);
}

const FIELD: Record<GrowthIndicator, string> = {
  weight: "weight_g",
  length: "height_cm",
  head: "head_cm",
};

/** ממיר את מה שנשמר על האירוע ליחידות של WHO. */
function valueOf(data: unknown, indicator: GrowthIndicator): number | null {
  const d = (data ?? {}) as Record<string, unknown>;
  const raw = d[FIELD[indicator]];
  if (typeof raw !== "number" || !(raw > 0)) return null;
  // המשקל נשמר בגרמים, ו-WHO עובד בקילוגרמים
  return indicator === "weight" ? raw / 1000 : raw;
}

/**
 * כל המדידות של מדד אחד, מהישנה לחדשה, עם האחוזון שלהן.
 *
 * מדידות מחוץ לטווח התקן (מעל גיל שנתיים) פשוט אינן נכנסות — עדיף
 * שלא יוצג אחוזון מאשר שיוצג אחד שגוי.
 */
export function growthSeries(
  events: Pick<EventRow, "started_at" | "type" | "data" | "deleted_at">[],
  birthDate: string,
  sex: GrowthSex,
  indicator: GrowthIndicator,
): GrowthPoint[] {
  const out: GrowthPoint[] = [];

  for (const e of events) {
    if (e.type !== "growth" || e.deleted_at) continue;

    const value = valueOf(e.data, indicator);
    if (value === null) continue;

    const ageDays = ageDaysAt(birthDate, e.started_at);
    const z = growthZ(sex, indicator, ageDays, value);
    if (z === null) continue;

    out.push({ at: e.started_at, ageDays, value, z, percentile: zToPercentile(z) });
  }

  return out.sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * ניסוח האחוזון בעברית.
 *
 * מתחת ל-1 ומעל ל-99 לא מציגים מספר: ההפרש בין אחוזון 0.4 ל-0.8 אינו
 * מידע שהורה יכול לעשות איתו משהו, והוא כן נשמע כמו ציון.
 */
export function percentileHebrew(percentile: number): string {
  if (percentile < 1) return "מתחת לאחוזון 1";
  if (percentile > 99) return "מעל אחוזון 99";
  return `אחוזון ${Math.round(percentile)}`;
}

export const INDICATOR_LABEL: Record<GrowthIndicator, string> = {
  weight: "משקל",
  length: "אורך",
  head: "היקף ראש",
};

export const INDICATOR_UNIT: Record<GrowthIndicator, string> = {
  weight: "ק״ג",
  length: "ס״מ",
  head: "ס״מ",
};

export { MAX_AGE_DAYS };
export type { GrowthIndicator, GrowthSex };
