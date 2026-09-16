/**
 * הצגת תינוק שעדיין אין לו שם.
 *
 * בימים הראשונים אין שם, וזה מצב תקין — לא "חסר מידע". לכן אין כאן
 * שדה ריק, אין "ללא שם", ואין לחץ למלא. רק כותרת נעימה ורמז עדין
 * בהגדרות שאפשר להוסיף שם כשיוחלט.
 */

export const UNNAMED_BABY_LABEL = "התינוק/ת";

export function babyDisplayName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : UNNAMED_BABY_LABEL;
}

export function hasName(name: string | null | undefined): boolean {
  return Boolean(name?.trim());
}

/** האות לעיגול האווטאר. כשאין שם — נחזיר null והרכיב יציג אייקון במקום. */
export function babyInitial(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed ? trimmed.charAt(0) : null;
}

/**
 * גיל מדויק לימים הראשונים.
 * ליילוד בן יומיים "יומיים ו-4 שעות" הוא מידע שימושי; "בן חודש" לא.
 */
export function newbornAge(
  birthDate: string,
  birthTime: string | null,
  now: Date = new Date(),
): string | null {
  const birth = new Date(`${birthDate}T${birthTime ?? "00:00"}`);
  const ms = now.getTime() - birth.getTime();
  if (ms < 0) return null;

  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return hours <= 1 ? "בן פחות משעה" : `${hours} שעות`;

  const days = Math.floor(hours / 24);
  if (days > 14) return null; // מעבר לכך babyAgeHebrew מדויק מספיק

  const remHours = hours % 24;
  const dayPart = days === 1 ? "יום" : days === 2 ? "יומיים" : `${days} ימים`;
  if (remHours === 0) return dayPart;
  return `${dayPart} ו-${remHours === 1 ? "שעה" : `${remHours} שעות`}`;
}
