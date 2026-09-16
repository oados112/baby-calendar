"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { EventType, Json } from "@/types/db";

/**
 * כתיבת רישומים מהדפדפן.
 *
 * הכתיבה נעשית ישירות מול Supabase ולא דרך השרת שלנו — ה-RLS כבר אוכף
 * מי רשאי לכתוב מה, אז שרת ביניים רק היה מוסיף השהיה. זה גם מה שמאפשר
 * ל-Realtime לעדכן את המכשיר השני תוך שנייה.
 */

export interface LogInput {
  babyId: string;
  type: EventType;
  startedAt: Date;
  endedAt?: Date | null;
  data?: Record<string, unknown>;
  note?: string | null;
}

export async function logEvent(input: LogInput): Promise<{ id: string }> {
  const supabase = getSupabaseBrowserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("נדרשת התחברות");

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
      created_by: user.id,
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
 * הטיימר חי בשרת ולא בדפדפן: כך הוא ממשיך לרוץ כשהמסך נכבה, שורד רענון,
 * ונראה בו-זמנית בשני המכשירים. הדפדפן רק מחשב כמה זמן עבר מ-started_at.
 */
export async function startTimer(
  babyId: string,
  type: EventType,
  side?: "left" | "right",
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("נדרשת התחברות");

  const now = new Date().toISOString();
  const { error } = await supabase.from("active_timers").upsert(
    {
      baby_id: babyId,
      type,
      side: side ?? null,
      started_at: now,
      segment_started_at: now,
      left_sec: 0,
      right_sec: 0,
      started_by: user.id,
    },
    { onConflict: "baby_id,type" },
  );

  if (error) throw new Error(error.message);
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
export async function switchSide(
  timerId: string,
  current: { side: "left" | "right" | null; leftSec: number; rightSec: number; segmentStartedAt: string },
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const elapsed = Math.floor(
    (Date.now() - new Date(current.segmentStartedAt).getTime()) / 1000,
  );

  const next = current.side === "left" ? "right" : "left";
  const { error } = await supabase
    .from("active_timers")
    .update({
      side: next,
      left_sec: current.side === "left" ? current.leftSec + elapsed : current.leftSec,
      right_sec: current.side === "right" ? current.rightSec + elapsed : current.rightSec,
      segment_started_at: new Date().toISOString(),
    })
    .eq("id", timerId);

  if (error) throw new Error(error.message);
}
