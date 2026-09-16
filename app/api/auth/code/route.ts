import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * כניסה בקוד אישי.
 *
 * הזרימה:
 *   1. הקוד נבדק מול ה-hash בבסיס הנתונים (עם ספירת ניסיונות כושלים)
 *   2. נמצא/נוצר משתמש Auth עבור המזהה של אותו קוד
 *   3. נוצר טוקן כניסה חד-פעמי בצד השרת — generateLink אינו שולח מייל
 *   4. הטוקן נפדה מיד, והעוגיות נכתבות לתשובה
 *
 * הקוד עצמו לעולם לא מגיע לבסיס הנתונים כטקסט, ולא נרשם בשום לוג.
 */

export const runtime = "nodejs";

/**
 * כשל בצד השרת.
 *
 * ה-stage מוחזר ללקוח בכוונה: הוא אומר איזה שלב נפל בלי לחשוף פרטים,
 * וחוסך חפירה בלוגים כשמשהו נשבר. ההודעה המלאה נשארת בלוג בלבד.
 */
function fail(stage: string, detail: string) {
  console.error(`[auth/code] ${stage}: ${detail}`);
  return NextResponse.json({ error: "server_error", stage }, { status: 500 });
}

function clientIp(request: NextRequest): string {
  // ב-Vercel הכתובת האמיתית נמצאת בכותרת הזו; היא נקבעת על ידי הפלטפורמה
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  let code: unknown;
  try {
    ({ code } = await request.json());
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (typeof code !== "string" || code.trim().length < 8) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // 1. אימות הקוד
  const { data: redeemed, error: redeemError } = await admin
    .rpc("redeem_access_code", { p_code: code, p_ip: clientIp(request) })
    .single();

  if (redeemError || !redeemed) {
    const message = redeemError?.message ?? "";

    if (message.includes("too_many_attempts")) {
      return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
    }
    // רק דחייה מפורשת של הקוד היא "קוד שגוי". כל שגיאה אחרת — הרשאות,
    // חיבור, פונקציה חסרה — חייבת להיראות אחרת, אחרת תקלת תשתית מתחזה
    // לטעות הקלדה של המשתמש ואי אפשר לאתר אותה.
    if (!message.includes("invalid_code")) {
      return fail("redeem", message);
    }

    return NextResponse.json({ error: "invalid_code" }, { status: 401 });
  }

  const { identity_email: email, code_id: codeId } = redeemed as {
    identity_email: string;
    code_id: string;
  };

  // 2. משתמש Auth עבור המזהה הזה
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  let userId = created?.user?.id;

  if (createError) {
    // כבר קיים — מאתרים אותו
    if (!/already|exists|registered/i.test(createError.message)) {
      return fail("create_user", createError.message);
    }
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;
  }

  if (!userId) {
    return fail("find_user", `no auth user for ${email}`);
  }

  // 3. צירוף למשפחה לפי מה שהוגדר בקוד
  const { error: attachError } = await admin.rpc("attach_code_user", {
    p_code_id: codeId,
    p_user_id: userId,
  });
  if (attachError) return fail("attach", attachError.message);

  // 4. טוקן כניסה — generateLink מייצר אותו בלי לשלוח מייל
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return fail("generate_link", linkError?.message ?? "no hashed_token returned");
  }

  // 5. פדיון הטוקן בלקוח שכותב את העוגיות לתשובה
  const supabase = await getSupabaseServerClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });

  if (verifyError) {
    return fail("verify", verifyError.message);
  }

  return NextResponse.json({ ok: true });
}
