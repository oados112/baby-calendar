import { NextResponse, type NextRequest } from "next/server";
import { runReminderCycle } from "@/lib/reminders/engine";

/**
 * מחזור התזכורות.
 *
 * נקרא מתוך Supabase (pg_cron) כל כמה דקות. הוא לא נקרא מהדפדפן ואין
 * לו ממשק — רק סוד משותף בכותרת מאפשר להריץ אותו, אחרת כל אחד באינטרנט
 * היה יכול להציף את המשפחה בהתראות.
 */

export const runtime = "nodejs";
// לעולם לא לשמור תשובה במטמון: כל הרצה חייבת לקרוא את המצב העדכני
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  // השוואה באורך קבוע כדי לא לדלוף מידע דרך זמן התגובה
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runReminderCycle();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/reminders]", error);
    return NextResponse.json({ error: "cycle_failed" }, { status: 500 });
  }
}

/** GET מאפשר הרצה ידנית לבדיקה, עם אותו סוד בדיוק. */
export async function GET(request: NextRequest) {
  return POST(request);
}
