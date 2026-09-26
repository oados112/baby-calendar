import { EVENT_META, summarizeEvent } from "@/lib/event-meta";
import { averageOf, formatHours, summarizeDays, type DaySummary } from "@/lib/stats";
import { dayKey, lastDayKeys } from "@/lib/zoned";
import type { EventRow } from "@/types/db";

/**
 * סיכום לרופא.
 *
 * הרעיון: רופא או אחות בטיפת חלב מקבלים עשר דקות לביקור, ושואלים
 * תמיד את אותן שאלות — כמה אוכלת, כמה ישנה, כמה חיתולים, היה חום,
 * ניתנו תרופות, איך המשקל. במקום לגלול איתם ביומן, המסך הזה עונה על
 * כולן במבט אחד.
 *
 * מה שהוא **לא** עושה: לא מפרש, לא מאבחן, ולא מסמן מה "תקין". הוא
 * מציג את מה שנרשם. הפירוש הוא תפקיד הרופא.
 */

export interface MedicalSummary {
  days: DaySummary[];
  avgFeeds: number;
  avgSleepMinutes: number;
  avgDiapers: number;
  avgBottleMl: number;
  /** מדידות חום, מהחדש לישן */
  temperatures: { at: string; celsius: number }[];
  highestTemp: number | null;
  /**
   * מנות תרופה, מקובצות לפי שם.
   * כולל את המינון והסכום הכולל — "כמה באמת קיבלה" היא השאלה שרופא
   * שואל, ומספר מנות לבדו לא עונה עליה.
   */
  medicines: {
    name: string;
    doses: number;
    lastAt: string;
    dose: number | null;
    unit: string | null;
    /** סכום כל המנות, אם המינון נרשם */
    totalAmount: number | null;
    /** מינון שונה בין מנות — אז אין טעם לסכום */
    mixedDoses: boolean;
    /** בכמה ימים נפרדים ניתנה, לחישוב היענות */
    daysGiven: number;
  }[];
  /** מדידות גדילה בתקופה */
  growth: EventRow[];
  /** קצב עלייה במשקל בין המדידה הראשונה לאחרונה בתקופה, בגרמים ליום */
  weightGainPerDay: number | null;
  notableNotes: { at: string; type: string; text: string }[];
  totalEvents: number;
}

function numberFrom(data: unknown, key: string): number | null {
  const d = (data ?? {}) as Record<string, unknown>;
  return typeof d[key] === "number" ? (d[key] as number) : null;
}

export function buildMedicalSummary(
  events: EventRow[],
  timeZone: string,
  dayCount: number,
  now = new Date(),
): MedicalSummary {
  const keys = lastDayKeys(dayKey(now, timeZone), dayCount);
  const days = summarizeDays(events, keys, timeZone);

  const temperatures = events
    .filter((e) => e.type === "temperature")
    .map((e) => ({ at: e.started_at, celsius: numberFrom(e.data, "celsius") ?? 0 }))
    .filter((t) => t.celsius > 0)
    .sort((a, b) => b.at.localeCompare(a.at));

  const byMedicine = new Map<
    string,
    {
      doses: number;
      lastAt: string;
      amounts: number[];
      unit: string | null;
      days: Set<string>;
    }
  >();

  for (const e of events) {
    if (e.type !== "medicine") continue;
    const d = (e.data ?? {}) as Record<string, unknown>;
    const name = typeof d.name === "string" ? d.name : "תרופה";
    const amount = typeof d.dose === "number" ? d.dose : null;
    const unit = typeof d.unit === "string" ? d.unit : null;

    const current = byMedicine.get(name) ?? {
      doses: 0,
      lastAt: e.started_at,
      amounts: [] as number[],
      unit,
      days: new Set<string>(),
    };

    current.doses += 1;
    if (current.lastAt < e.started_at) current.lastAt = e.started_at;
    if (amount !== null) current.amounts.push(amount);
    if (unit && !current.unit) current.unit = unit;
    current.days.add(e.started_at.slice(0, 10));

    byMedicine.set(name, current);
  }

  const growth = events
    .filter((e) => e.type === "growth")
    .sort((a, b) => a.started_at.localeCompare(b.started_at));

  const weights = growth
    .map((e) => ({ at: e.started_at, g: numberFrom(e.data, "weight_g") }))
    .filter((w): w is { at: string; g: number } => w.g !== null);

  let weightGainPerDay: number | null = null;
  if (weights.length >= 2) {
    const first = weights[0];
    const last = weights[weights.length - 1];
    const dayDiff =
      (new Date(last.at).getTime() - new Date(first.at).getTime()) / 86_400_000;
    if (dayDiff >= 1) weightGainPerDay = (last.g - first.g) / dayDiff;
  }

  // הערות חופשיות הן לרוב מה שההורה חשב ששווה לציין — בדיוק מה
  // שהרופא רוצה לשמוע, ומה שנשכח בחדר הטיפולים
  const notableNotes = events
    .filter((e) => e.note && e.note.trim().length > 0)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, 12)
    .map((e) => ({
      at: e.started_at,
      type: EVENT_META[e.type].label,
      text: [summarizeEvent(e.type, e.data), e.note].filter(Boolean).join(" · "),
    }));

  return {
    days,
    avgFeeds: averageOf(days.map((d) => d.feeds)),
    avgSleepMinutes: averageOf(days.map((d) => d.sleepMinutes)),
    avgDiapers: averageOf(days.map((d) => d.diapers)),
    avgBottleMl: averageOf(days.map((d) => d.bottleMl)),
    temperatures,
    highestTemp: temperatures.length
      ? Math.max(...temperatures.map((t) => t.celsius))
      : null,
    medicines: [...byMedicine.entries()]
      .map(([name, info]) => {
        const unique = [...new Set(info.amounts)];
        const mixedDoses = unique.length > 1;

        return {
          name,
          doses: info.doses,
          lastAt: info.lastAt,
          dose: unique.length === 1 ? unique[0] : null,
          unit: info.unit,
          totalAmount:
            info.amounts.length === info.doses && info.amounts.length > 0
              ? info.amounts.reduce((a, b) => a + b, 0)
              : null,
          mixedDoses,
          daysGiven: info.days.size,
        };
      })
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt)),
    growth,
    weightGainPerDay,
    notableNotes,
    totalEvents: events.length,
  };
}

/** טקסט קצר שאפשר להקריא או להעתיק להודעה. */
export function summaryAsText(
  summary: MedicalSummary,
  babyName: string,
  dayCount: number,
): string {
  const lines: string[] = [
    `${babyName} — סיכום ${dayCount} הימים האחרונים`,
    "",
    `האכלות: ${summary.avgFeeds.toFixed(1)} ביום בממוצע`,
  ];

  if (summary.avgBottleMl > 0) {
    lines.push(`בקבוק: ${Math.round(summary.avgBottleMl)} מ״ל ביום בממוצע`);
  }

  lines.push(
    `שינה: ${formatHours(summary.avgSleepMinutes)} ביום בממוצע`,
    `חיתולים: ${summary.avgDiapers.toFixed(1)} ביום בממוצע`,
  );

  if (summary.weightGainPerDay !== null) {
    lines.push(
      `עלייה במשקל: ${Math.round(summary.weightGainPerDay)} גרם ליום בתקופה`,
    );
  }

  if (summary.highestTemp !== null) {
    lines.push(`חום מרבי שנמדד: ${summary.highestTemp.toFixed(1)}°`);
  }

  if (summary.medicines.length > 0) {
    lines.push("", "תרופות וויטמינים:");
    for (const m of summary.medicines) {
      const dose = m.dose !== null ? `${m.dose} ${m.unit ?? ""}`.trim() : null;
      const total =
        m.totalAmount !== null && !m.mixedDoses
          ? ` = ${m.totalAmount} ${m.unit ?? ""}`.trimEnd()
          : "";
      lines.push(
        `  ${m.name}: ${dose ? `${dose} × ` : ""}${m.doses} מנות${total}` +
          ` · ניתן ב-${m.daysGiven} מתוך ${dayCount} ימים`,
      );
    }
  }

  return lines.join("\n");
}
