import { dayRange, dayKey } from "@/lib/zoned";

/**
 * לוגיקת סל התרופות והוויטמינים.
 *
 * פונקציות טהורות בלבד — אותו קלט תמיד נותן אותה תוצאה, והן משמשות גם
 * את מסך הבית וגם את מנוע ההתראות בשרת. כך אין סיכוי שהמסך יגיד "הגיע
 * הזמן" וההתראה תחשוב אחרת.
 *
 * הכלל שמנחה את הקובץ: **'as_needed' לעולם לא נחשבת "מגיע לה זמן".**
 * אקמול ניתן כשיש חום, לא כשעברו שש שעות. התראה כזו דוחפת לתת תרופה
 * שאין בה צורך.
 */

export type MedicationSchedule = "interval" | "daily_at" | "as_needed";

export interface MedicationPlan {
  id: string;
  baby_id: string;
  kind: "vitamin" | "medicine";
  name: string;
  dose_amount: number | null;
  dose_unit: string | null;
  schedule: MedicationSchedule;
  every_hours: number | null;
  daily_at: string | null;
  max_per_day: number | null;
  starts_on: string | null;
  ends_on: string | null;
  reminder_enabled: boolean;
  is_active: boolean;
  note: string | null;
}

export interface DoseRecord {
  started_at: string;
  data: unknown;
}

/** המנות של תוכנית מסוימת, מהחדשה לישנה. */
export function dosesFor(plan: MedicationPlan, events: DoseRecord[]): DoseRecord[] {
  return events
    .filter((e) => {
      const d = (e.data ?? {}) as Record<string, unknown>;
      // קישור לפי מזהה התוכנית, ובגיבוי לפי שם — כדי שגם מנות שנרשמו
      // לפני שהתוכנית הוגדרה ייספרו
      if (d.plan_id === plan.id) return true;
      return typeof d.name === "string" && d.name === plan.name;
    })
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
}

export function dosesToday(
  plan: MedicationPlan,
  events: DoseRecord[],
  timeZone: string,
  now: Date,
): number {
  const today = dayKey(now, timeZone);
  return dosesFor(plan, events).filter(
    (e) => dayKey(new Date(e.started_at), timeZone) === today,
  ).length;
}

/** האם התוכנית פעילה בתאריך הנוכחי (קורס שהתחיל ועוד לא נגמר). */
export function isWithinCourse(
  plan: MedicationPlan,
  timeZone: string,
  now: Date,
): boolean {
  const today = dayKey(now, timeZone);
  if (plan.starts_on && today < plan.starts_on) return false;
  if (plan.ends_on && today > plan.ends_on) return false;
  return true;
}

/**
 * מתי המנה הבאה אמורה להינתן.
 * מחזיר null כשאין מועד — תרופה לפי הצורך, קורס שנגמר, או מיצוי יומי.
 */
export function nextDueAt(
  plan: MedicationPlan,
  events: DoseRecord[],
  timeZone: string,
  now: Date,
): Date | null {
  if (!plan.is_active) return null;
  if (plan.schedule === "as_needed") return null;
  if (!isWithinCourse(plan, timeZone, now)) return null;

  if (plan.max_per_day && dosesToday(plan, events, timeZone, now) >= plan.max_per_day) {
    return null;
  }

  const doses = dosesFor(plan, events);
  const last = doses[0] ?? null;

  if (plan.schedule === "interval") {
    const hours = plan.every_hours ?? 24;

    if (!last) {
      // עוד לא ניתנה מנה: סופרים מתחילת הקורס, ואם אין — מעכשיו
      if (!plan.starts_on) return now;
      const { from } = dayRange(plan.starts_on, timeZone);
      return from;
    }

    return new Date(new Date(last.started_at).getTime() + hours * 3600_000);
  }

  // daily_at: היום בשעה שנקבעה, אלא אם כבר ניתנה מנה היום
  const [h, m] = (plan.daily_at ?? "09:00").split(":").map(Number);
  const todayKey = dayKey(now, timeZone);

  if (last && dayKey(new Date(last.started_at), timeZone) === todayKey) {
    return null;
  }

  const { from } = dayRange(todayKey, timeZone);
  return new Date(from.getTime() + (h * 60 + m) * 60_000);
}

export interface DueInfo {
  plan: MedicationPlan;
  dueAt: Date;
  /** דקות שעברו מאז שהגיע הזמן */
  overdueMinutes: number;
}

/** התוכניות שהגיע זמנן ועדיין לא ניתנו. */
export function dueNow(
  plans: MedicationPlan[],
  events: DoseRecord[],
  timeZone: string,
  now: Date,
): DueInfo[] {
  const out: DueInfo[] = [];

  for (const plan of plans) {
    const dueAt = nextDueAt(plan, events, timeZone, now);
    if (!dueAt || dueAt.getTime() > now.getTime()) continue;

    out.push({
      plan,
      dueAt,
      overdueMinutes: Math.floor((now.getTime() - dueAt.getTime()) / 60_000),
    });
  }

  return out.sort((a, b) => b.overdueMinutes - a.overdueMinutes);
}

/** "כל 8 שעות" / "כל יום ב-10:00" / "לפי הצורך" */
export function describeSchedule(plan: MedicationPlan): string {
  if (plan.schedule === "as_needed") return "לפי הצורך";

  if (plan.schedule === "daily_at") {
    return `כל יום ב-${(plan.daily_at ?? "").slice(0, 5)}`;
  }

  const hours = plan.every_hours ?? 24;
  if (hours === 24) return "פעם ביום";
  if (hours === 12) return "פעמיים ביום";
  if (hours % 1 === 0) return `כל ${hours} שעות`;
  return `כל ${hours} שעות`;
}

/** "400 יחב״ל" */
export function describeDose(plan: MedicationPlan): string | null {
  if (plan.dose_amount === null) return null;
  const amount = Number.isInteger(plan.dose_amount)
    ? String(plan.dose_amount)
    : String(plan.dose_amount);
  return [amount, plan.dose_unit].filter(Boolean).join(" ");
}

export const DOSE_UNITS = ["מ״ל", "טיפות", "מ״ג", "יחב״ל", "טבליה", "שקית"];
