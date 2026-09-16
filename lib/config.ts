/**
 * האם Supabase מוגדר.
 *
 * כל עוד לא הוקם פרויקט Supabase, האתר רץ במצב תצוגה (demo) עם נתוני דוגמה,
 * כדי שאפשר יהיה לפתח ולבחון את הממשק. ברגע שמשתני הסביבה קיימים,
 * המצב הזה נכבה מעצמו ואין צורך לשנות קוד.
 */
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/**
 * כתובת הבסיס של האתר, לבניית קישורי חזרה (התחברות, הזמנות).
 *
 * בדפדפן לוקחים אותה מהדפדפן עצמו ולא ממשתנה סביבה. זה נכון תמיד:
 * ב-localhost, בכתובת הפרודקשן, ובכל preview deployment של Vercel —
 * בלי להגדיר כלום ובלי הסיכון שמישהו יקליד את הכתובת הלא נכונה.
 *
 * משתנה הסביבה משמש רק בצד השרת, שם אין window.
 */
export function getSiteOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
