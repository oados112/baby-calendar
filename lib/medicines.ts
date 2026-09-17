/**
 * תרופות ותוספים נפוצים לתינוקות.
 *
 * חשוב להבין מה זה כן ומה זה לא:
 *
 *  • זו **תזכורת**, לא הוראה רפואית. המרווחים כאן הם ברירות מחדל
 *    שמרניות המבוססות על מה שמופיע בדרך כלל על האריזה.
 *  • המינון **אינו** מחושב כאן ולא מוצע כאן. מינון לתינוק נקבע לפי
 *    משקל ולפי הוראת רופא, והאתר רק רושם מה שכבר ניתן בפועל.
 *  • כל מרווח ניתן לשינוי, כי מה שהרופא אמר גובר על ברירת המחדל.
 */

export interface MedicineDef {
  id: string;
  label: string;
  /** שם החומר הפעיל, לזיהוי כשיש מותגים שונים */
  ingredient?: string;
  units: string[];
  /** מרווח מינימלי מומלץ בין מנות, בשעות */
  minHours: number;
  /** מספר מנות מרבי ביממה, אם יש */
  maxPerDay?: number;
  note?: string;
}

export const MEDICINES: MedicineDef[] = [
  {
    id: "paracetamol",
    label: "אקמול / פרצטמול",
    ingredient: "פרצטמול",
    units: ["מ״ל", "טיפות", "מ״ג"],
    minHours: 4,
    maxPerDay: 4,
    note: "בדרך כלל לא יותר מ-4 מנות ביממה",
  },
  {
    id: "ibuprofen",
    label: "נורופן / איבופרופן",
    ingredient: "איבופרופן",
    units: ["מ״ל", "מ״ג"],
    minHours: 6,
    maxPerDay: 3,
    note: "לרוב לא לפני גיל 6 חודשים, אלא בהוראת רופא",
  },
  {
    id: "vitamin_d",
    label: "ויטמין D",
    units: ["טיפות", "מ״ל"],
    minHours: 20,
    maxPerDay: 1,
    note: "ניתן בדרך כלל פעם ביום",
  },
  {
    id: "iron",
    label: "ברזל",
    units: ["טיפות", "מ״ל"],
    minHours: 20,
    maxPerDay: 1,
  },
  {
    id: "probiotic",
    label: "פרוביוטיקה",
    units: ["טיפות", "מ״ל", "שקית"],
    minHours: 20,
    maxPerDay: 1,
  },
  {
    id: "other",
    label: "אחר",
    units: ["מ״ל", "טיפות", "מ״ג", "טבליה"],
    minHours: 0,
  },
];

export function findMedicine(id: string | null | undefined): MedicineDef {
  return MEDICINES.find((m) => m.id === id) ?? MEDICINES[MEDICINES.length - 1];
}

export interface DoseCheck {
  /** מותר לפי המרווח */
  ok: boolean;
  /** כמה זמן נותר עד המנה הבאה, בדקות */
  minutesRemaining: number;
  /** כמה מנות כבר ניתנו ביממה האחרונה */
  dosesToday: number;
  /** חריגה ממספר המנות המרבי */
  overDailyLimit: boolean;
  lastGivenAt: string | null;
}

/**
 * בודק מתי ניתנה המנה האחרונה של אותה תרופה וכמה ניתנו ביממה.
 * מקבל את הרישומים כפרמטר — פונקציה טהורה, בלי גישה לרשת.
 */
export function checkDose({
  medicineId,
  events,
  now,
  minHours,
  maxPerDay,
}: {
  medicineId: string;
  events: { type: string; started_at: string; data: unknown }[];
  now: Date;
  minHours: number;
  maxPerDay?: number;
}): DoseCheck {
  const dayAgo = now.getTime() - 24 * 3600_000;

  const doses = events
    .filter((e) => e.type === "medicine")
    .filter((e) => {
      const data = (e.data ?? {}) as Record<string, unknown>;
      return data.medicine_id === medicineId;
    })
    .sort((a, b) => b.started_at.localeCompare(a.started_at));

  const last = doses[0] ?? null;
  const dosesToday = doses.filter(
    (e) => new Date(e.started_at).getTime() >= dayAgo,
  ).length;

  if (!last || minHours <= 0) {
    return {
      ok: true,
      minutesRemaining: 0,
      dosesToday,
      overDailyLimit: maxPerDay ? dosesToday >= maxPerDay : false,
      lastGivenAt: last?.started_at ?? null,
    };
  }

  const elapsedMinutes = (now.getTime() - new Date(last.started_at).getTime()) / 60_000;
  const requiredMinutes = minHours * 60;
  const minutesRemaining = Math.max(0, Math.ceil(requiredMinutes - elapsedMinutes));

  return {
    ok: minutesRemaining === 0,
    minutesRemaining,
    dosesToday,
    overDailyLimit: maxPerDay ? dosesToday >= maxPerDay : false,
    lastGivenAt: last.started_at,
  };
}
