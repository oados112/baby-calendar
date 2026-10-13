/**
 * תעודת זהות ישראלית.
 *
 * למה בכלל לאמת: הספרה האחרונה היא ספרת ביקורת, ולכן טעות הקלדה אחת
 * כמעט תמיד נתפסת כאן ולא בדלפק של טיפת חלב. מספר שגוי שנשמר בשקט
 * גרוע ממספר שלא נשמר בכלל.
 *
 * האלגוריתם: כל ספרה מוכפלת לסירוגין ב-1 וב-2 משמאל לימין, מכפלה
 * דו-ספרתית מוחלפת בסכום ספרותיה, והסכום הכולל חייב להתחלק ב-10.
 */

/** משאיר ספרות בלבד ומשלים לתשע ספרות באפסים מובילים. */
export function normalizeNationalId(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.length > 0 && digits.length < 9 ? digits.padStart(9, "0") : digits;
}

export function isValidNationalId(input: string): boolean {
  const id = normalizeNationalId(input);
  if (!/^\d{9}$/.test(id)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const product = Number(id[i]) * ((i % 2) + 1);
    sum += product > 9 ? product - 9 : product;
  }

  return sum % 10 === 0;
}

/** "123456789" → "12345678-9", כפי שהיא מודפסת בתעודה. */
export function formatNationalId(id: string): string {
  const clean = normalizeNationalId(id);
  return clean.length === 9 ? `${clean.slice(0, 8)}-${clean.slice(8)}` : clean;
}

/** "•••••••-9" — מספיק כדי לזהות שהמספר נכון, בלי להציג אותו. */
export function maskNationalId(id: string): string {
  const clean = normalizeNationalId(id);
  if (clean.length !== 9) return "•••••••••";
  return `${"•".repeat(8)}-${clean.slice(8)}`;
}
