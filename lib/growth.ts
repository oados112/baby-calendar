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

/**
 * ההפך מ-zToPercentile: הסטייה שמתאימה לאחוזון.
 *
 * קירוב Acklam, מדויק עד כ-1e-9 — הרבה מעבר למה שצריך כדי לצייר
 * רצועה או למלא תא בטבלה. קיים כדי שלא נחזיק ערכי z קבועים בקוד:
 * אחוזון 3 הוא ‎-1.8808 ולא ‎-1.88, והפרש כזה זז בגרמים.
 */
export function percentileToZ(percentile: number): number {
  const p = Math.min(0.999999, Math.max(0.000001, percentile / 100));

  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687,
             138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866,
             66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838,
             -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996,
             3.754408661907416];

  const lower = 0.02425;

  if (p < lower) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  if (p > 1 - lower) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
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
 * גיל קצר לתא בטבלה: "לידה", "12 ימים", "7 שבועות", "4 חודשים".
 *
 * בלי שארית הימים, בניגוד לכותרת במסך הבית — בטבלה הגיל הוא עמודת
 * עזר שמסבירה מתי, והדיוק נמצא ממילא בעמודת התאריך.
 */
export function compactAge(ageDays: number): string {
  if (ageDays <= 0) return "לידה";
  if (ageDays === 1) return "יום";
  if (ageDays < 14) return `${ageDays} ימים`;
  if (ageDays < 91) {
    const weeks = Math.floor(ageDays / 7);
    return weeks === 2 ? "שבועיים" : `${weeks} שבועות`;
  }
  const months = Math.round(ageDays / 30.4375);
  return months === 2 ? "חודשיים" : `${months} חודשים`;
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

/** האחוזונים שמופיעים בעקומות של משרד הבריאות. */
export const REFERENCE_PERCENTILES = [3, 15, 50, 85, 97] as const;

export interface ReferenceRow {
  week: number;
  ageDays: number;
  /** ערך לכל אחוזון, באותו סדר כמו REFERENCE_PERCENTILES */
  values: number[];
}

/**
 * טבלת הייחוס המלאה: שורה לשבוע, עמודה לאחוזון.
 *
 * זו אותה טבלה שמודפסת בפנקס, רק שאפשר לקרוא ממנה מספר במקום להעריך
 * אותו מתוך גרף. שימושית בדיוק כשרוצים לדעת "כמה היא אמורה לשקול
 * בשבוע הבא כדי להישאר באותו אחוזון".
 */
export function referenceRows(
  sex: GrowthSex,
  indicator: GrowthIndicator,
  percentiles: readonly number[] = REFERENCE_PERCENTILES,
): ReferenceRow[] {
  const zs = percentiles.map(percentileToZ);
  const rows: ReferenceRow[] = [];

  for (let week = 0; week * 7 <= MAX_AGE_DAYS; week++) {
    const ageDays = week * 7;
    const values = zs.map((z) => valueAtZ(sex, indicator, ageDays, z));
    if (values.some((v) => v === null)) continue;
    rows.push({ week, ageDays, values: values as number[] });
  }

  return rows;
}
