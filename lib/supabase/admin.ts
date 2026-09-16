import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * לקוח עם הרשאות מלאות, לצד השרת בלבד.
 *
 * הוא עוקף RLS לחלוטין, ולכן:
 *  • "server-only" למעלה גורם לשגיאת בנייה אם קובץ לקוח ייבא אותו בטעות
 *  • המפתח נקרא ממשתנה סביבה ללא קידומת NEXT_PUBLIC, כך שהוא לא נכנס
 *    לחבילת הדפדפן בשום מקרה
 *  • משמש אך ורק במסלול אחד: המרת קוד כניסה לסשן
 */
export function getSupabaseAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "חסר SUPABASE_SERVICE_ROLE_KEY. יש להגדיר אותו ב-.env.local ובמשתני הסביבה של Vercel.",
    );
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
