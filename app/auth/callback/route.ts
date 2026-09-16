import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * נקודת הנחיתה של הקישור מהמייל.
 *
 * Supabase שולח קוד חד-פעמי; כאן הוא מוחלף בסשן, והעוגייה נכתבת בתשובה.
 * מכאן ואילך כל בקשה — גם מהשרת — מזוהה.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // שגיאה שהגיעה מ-Supabase עצמו (קישור שפג תוקפו, למשל)
  const authError = searchParams.get("error_description") ?? searchParams.get("error");
  if (authError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(authError)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("הקישור אינו תקף או שפג תוקפו")}`,
    );
  }

  // פתוח redirect הוא פרצה — מאשרים רק נתיבים פנימיים
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
