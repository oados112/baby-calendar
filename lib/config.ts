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

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
