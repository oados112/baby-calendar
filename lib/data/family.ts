import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ActiveTimerRow, BabyRow, EventRow, FamilyMemberRow } from "@/types/db";

/**
 * שאילתות צד-שרת.
 * כולן עוברות דרך לקוח ה-anon ולכן כפופות ל-RLS — מה שהמשתמש לא רשאי
 * לראות פשוט לא יחזור, בלי שנצטרך לסנן כאן שוב.
 */

export interface FamilyContext {
  member: FamilyMemberRow;
  babies: BabyRow[];
}

/** null = המשתמש מחובר אך עדיין לא שייך למשפחה (צריך onboarding). */
export async function getFamilyContext(): Promise<FamilyContext | null> {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("family_members")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return null;

  const { data: babies } = await supabase
    .from("babies")
    .select("*")
    .eq("family_id", member.family_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return { member, babies: babies ?? [] };
}

/** אירועי היממה האחרונה של תינוק, החדש ביותר קודם. */
export async function getRecentEvents(
  babyId: string,
  hours = 24,
): Promise<EventRow[]> {
  const supabase = await getSupabaseServerClient();
  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("baby_id", babyId)
    .is("deleted_at", null)
    .gte("started_at", since)
    .order("started_at", { ascending: false });

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

/** אזור הזמן של המשפחה — הבסיס לכל חישובי "יום". */
export async function getFamilyTimezone(familyId: string): Promise<string> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("families")
    .select("timezone")
    .eq("id", familyId)
    .maybeSingle();

  return data?.timezone ?? "Asia/Jerusalem";
}
