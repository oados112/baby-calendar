"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ActiveTimerRow, EventRow, EventType, Json } from "@/types/db";

/**
 * כתיבת רישומים מהדפדפן.
 *
 * הכתיבה ישירה מול Supabase ולא דרך השרת שלנו — ה-RLS כבר אוכף מי רשאי
 * לכתוב מה, אז שרת ביניים רק היה מוסיף השהיה.
 *
 * שימו לב ש-userId מגיע כפרמטר ואיננו נשלף כאן. זה מכוון: קריאה ל-
 * auth.getUser() פונה לרשת, וכשהיא קדמה לכל כתיבה היא הכפילה את זמן
 * התגובה של כל לחיצה. מזהה המשתמש ידוע ממילא בשרת ומועבר לדף.
 */

export interface LogInput {
  babyId: string;
  type: EventType;
  startedAt: Date;
  endedAt?: Date | null;
  data?: Record<string, unknown>;
  note?: string | null;
}

export async function logEvent(
  input: LogInput,
  userId: string,
): Promise<{ id: string }> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from("events")
    .insert({
      baby_id: input.babyId,
      // family_id לא נשלח בכוונה: טריגר בבסיס הנתונים גוזר אותו מהתינוק.
      // כך הלקוח לא יכול לשייך רישום למשפחה אחרת גם אם ינסה.
      type: input.type,
      started_at: input.startedAt.toISOString(),
      ended_at: input.endedAt ? input.endedAt.toISOString() : null,
      data: (input.data ?? {}) as Json,
      note: input.note?.trim() || null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id };
}

/** מחיקה רכה. הרישום נשמר במסד ורק מוסתר, כדי שטעות לא תהיה סופית. */
export async function deleteEvent(eventId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("soft_delete_event", { p_event_id: eventId });
  if (error) throw new Error(error.message);
}

/**
 * טיימר משותף.
 *
 * הטיימר נשמר בשרת ולא בדפדפן: כך הוא ממשיך לרוץ כשהמסך נעול, שורד
 * רענון, ונראה בו-זמנית בשני המכשירים. הדפדפן רק מחשב כמה זמן עבר.
 */
export async function startTimer(
  babyId: string,
  type: EventType,
  userId: string,
  side?: "left" | "right",
): Promise<ActiveTimerRow> {
  const supabase = getSupabaseBrowserClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("active_timers")
    .upsert(
      {
        baby_id: babyId,
        type,
        side: side ?? null,
        started_at: now,
        segment_started_at: now,
        left_sec: 0,
        right_sec: 0,
        started_by: userId,
      },
      { onConflict: "baby_id,type" },
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function cancelTimer(babyId: string, type: EventType): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("active_timers")
    .delete()
    .eq("baby_id", babyId)
    .eq("type", type);
  if (error) throw new Error(error.message);
}

/** החלפת צד בהנקה: צוברים את הזמן של הצד הנוכחי וממשיכים בשני. */
export function nextSideState(current: ActiveTimerRow): Partial<ActiveTimerRow> {
  const elapsed = Math.floor(
    (Date.now() - new Date(current.segment_started_at).getTime()) / 1000,
  );

  return {
    side: current.side === "left" ? "right" : "left",
    left_sec: current.side === "left" ? current.left_sec + elapsed : current.left_sec,
    right_sec:
      current.side === "right" ? current.right_sec + elapsed : current.right_sec,
    segment_started_at: new Date().toISOString(),
  };
}

export async function switchSide(
  timerId: string,
  patch: Partial<ActiveTimerRow>,
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("active_timers")
    .update(patch)
    .eq("id", timerId);

  if (error) throw new Error(error.message);
}

/**
 * עריכת רישום קיים.
 *
 * שולחים רק את מה שהשתנה. ה-RLS מחליט אם מותר: מנהל עורך הכל, רושם
 * עורך רק את מה שהוא עצמו רשם ורק בתוך 24 שעות.
 */
export interface EventPatch {
  startedAt?: Date;
  endedAt?: Date | null;
  data?: Record<string, unknown>;
  note?: string | null;
}

export async function updateEvent(
  eventId: string,
  patch: EventPatch,
  userId: string,
): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  const payload: Partial<EventRow> = { updated_by: userId };
  if (patch.startedAt) payload.started_at = patch.startedAt.toISOString();
  if (patch.endedAt !== undefined) {
    payload.ended_at = patch.endedAt ? patch.endedAt.toISOString() : null;
  }
  if (patch.data !== undefined) payload.data = patch.data as Json;
  if (patch.note !== undefined) payload.note = patch.note?.trim() || null;

  const { error } = await supabase.from("events").update(payload).eq("id", eventId);
  if (error) throw new Error(error.message);
}
