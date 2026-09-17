"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { EVENT_META, summarizeEvent } from "@/lib/event-meta";
import { dayKey } from "@/lib/zoned";
import type { EventRow } from "@/types/db";

/**
 * ייצוא היומן.
 *
 * הפורמט הוא CSV ולא PDF בכוונה: רופא או אחות בטיפת חלב יכולים לפתוח
 * אותו באקסל, למיין ולסנן. PDF נראה יפה אבל הוא תמונה של נתונים ולא
 * נתונים. למי שרוצה דף מודפס — הדפסה של מסך היומן מהדפדפן עושה בדיוק
 * את זה, בלי שנצטרך לייצר קובץ.
 */

/** שולף את כל הרישומים בעמודים, כדי לא להפיל בקשה אחת ענקית. */
export async function fetchAllEvents(babyId: string): Promise<EventRow[]> {
  const supabase = getSupabaseBrowserClient();
  const all: EventRow[] = [];
  let before: string | null = null;

  // לולאה חסומה: גם ביומן של שנים זה עשרות בקשות לכל היותר
  for (let page = 0; page < 200; page++) {
    let query = supabase
      .from("events")
      .select("*")
      .eq("baby_id", babyId)
      .is("deleted_at", null)
      .order("started_at", { ascending: false })
      .limit(500);

    if (before) query = query.lt("started_at", before);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < 500) break;
    before = data[data.length - 1].started_at;
  }

  return all.reverse();
}

/** מגן מפני נוסחאות: תא שמתחיל ב-= או ב-+ מתפרש באקסל כקוד. */
function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildCsv(
  events: EventRow[],
  memberNames: Record<string, string>,
  timeZone: string,
): string {
  const header = [
    "תאריך",
    "שעה",
    "סוג",
    "פרטים",
    "משך (דקות)",
    "הערה",
    "נרשם על ידי",
  ];

  const rows = events.map((e) => {
    const start = new Date(e.started_at);
    const minutes = e.ended_at
      ? Math.round(
          (new Date(e.ended_at).getTime() - start.getTime()) / 60_000,
        )
      : "";

    return [
      csvCell(dayKey(start, timeZone)),
      csvCell(
        start.toLocaleTimeString("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone,
        }),
      ),
      csvCell(EVENT_META[e.type].label),
      csvCell(summarizeEvent(e.type, e.data) ?? ""),
      csvCell(minutes),
      csvCell(e.note ?? ""),
      csvCell(memberNames[e.created_by] ?? ""),
    ].join(",");
  });

  // BOM: בלעדיו אקסל בווינדוס מציג עברית כג'יבריש
  return "﻿" + [header.map(csvCell).join(","), ...rows].join("\r\n");
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // שחרור הזיכרון אחרי שהדפדפן הספיק להתחיל את ההורדה
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
