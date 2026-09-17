import type { BabyRow } from "@/types/db";

/**
 * בחירת הילד/ה הפעיל/ה.
 *
 * במשפחה עם ילד אחד זה תמיד אותו אחד ואין מה לבחור. עם יותר מאחד,
 * הבחירה נשמרת בעוגייה — כך היא נשמרת בין מסכים ובין ביקורים, בלי
 * שכל קישור באתר יצטרך לשאת פרמטר.
 */

export const SELECTED_BABY_COOKIE = "bc:baby";

/** מחזיר את הנבחר/ת, או הראשון/ה אם הבחירה כבר לא קיימת. */
export function pickBaby(babies: BabyRow[], selectedId?: string): BabyRow | null {
  if (babies.length === 0) return null;
  return babies.find((b) => b.id === selectedId) ?? babies[0];
}
