import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ActiveTimerRow, BabyRow, EventRow, FamilyMemberRow } from "@/types/db";

/**
 * שאילתות צד-שרת.
 *
 * כולן עוברות דרך לקוח ה-anon ולכן כפופות ל-RLS — מה שהמשתמש לא רשאי
 * לראות פשוט לא יחזור, בלי שנצטרך לסנן כאן שוב.
 *
 * הערה על מהירות: זיהוי המשתמש נעשה ב-getClaims(), שמאמת את הטוקן
 * מקומית מול מפתח ציבורי במטמון. getUser() לעומתו פונה לשרת האימות
 * בכל בקשה, וזו הייתה נסיעת רשת מיותרת בכל מעבר בין עמודים.
 */

export interface FamilyContext {
  member: FamilyMemberRow;
  babies: BabyRow[];
  timeZone: string;
}

export async function currentUserId(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === "string" ? sub : null;
}

/** null = המשתמש מחובר אך עדיין לא שייך למשפחה (צריך onboarding). */
export async function getFamilyContext(): Promise<FamilyContext | null> {
  const supabase = await getSupabaseServerClient();

  const userId = await currentUserId();
  if (!userId) return null;

  // חברות + אזור הזמן של המשפחה בשאילתה אחת במקום בשתיים
  const { data: member } = await supabase
    .from("family_members")
    .select("*, families(timezone)")
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) return null;

  const { data: babies } = await supabase
    .from("babies")
    .select("*")
    .eq("family_id", member.family_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const joined = member as FamilyMemberRow & {
    families?: { timezone?: string } | null;
  };

  return {
    member,
    babies: babies ?? [],
    timeZone: joined.families?.timezone ?? "Asia/Jerusalem",
  };
}

/**
 * העמוד הראשון של יומן הרישומים, החדש ביותר קודם.
 *
 * ללא חלון זמן: היומן הוא רצף מתמשך שאפשר לגלול בו אחורה, והדפדוף
 * בהמשך נעשה מהלקוח לפי חותמת הזמן של הרישום האחרון שהוצג.
 */
export async function getEventsPage(
  babyId: string,
  limit = 41,
): Promise<EventRow[]> {
  const supabase = await getSupabaseServerClient();

  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("baby_id", babyId)
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

/** השמות להצגה של חברי המשפחה, לפי מזהה משתמש. */
export async function getMemberNames(
  familyId: string,
): Promise<Record<string, string>> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("family_members")
    .select("user_id, display_name")
    .eq("family_id", familyId);

  return Object.fromEntries((data ?? []).map((m) => [m.user_id, m.display_name]));
}

/** טיימרים שרצים כרגע — משותפים לכל המכשירים של המשפחה. */
export async function getActiveTimers(babyId: string): Promise<ActiveTimerRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("active_timers")
    .select("*")
    .eq("baby_id", babyId);
  return data ?? [];
}

/** אירועים בטווח זמן נתון, מהחדש לישן. */
export async function getEventsBetween(
  babyId: string,
  from: Date,
  to: Date,
): Promise<EventRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("baby_id", babyId)
    .is("deleted_at", null)
    .gte("started_at", from.toISOString())
    .lt("started_at", to.toISOString())
    .order("started_at", { ascending: false });

  return data ?? [];
}

/** כל מדידות הגדילה, מהישן לחדש — מעט שורות גם אחרי שנים. */
export async function getGrowthEvents(babyId: string): Promise<EventRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("baby_id", babyId)
    .eq("type", "growth")
    .is("deleted_at", null)
    .order("started_at", { ascending: true });

  return data ?? [];
}
