/**
 * זמן בעברית.
 *
 * העיקרון: בן אדם עייף לא מחשב הפרשי שעות. "לפני שעה ורבע" נקרא במבט,
 * "13:42" דורש חישוב. לכן כל הצגת זמן באתר עוברת דרך כאן.
 */

const MIN = 60;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function secondsSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000));
}

/**
 * "לפני רגע" / "לפני 12 דקות" / "לפני שעה ורבע" / "לפני 3 שעות" / "אתמול ב-14:30"
 */
export function relativeHebrew(iso: string, now: Date = new Date()): string {
  const s = secondsSince(iso, now);

  if (s < 45) return "ממש עכשיו";
  if (s < 2 * MIN) return "לפני דקה";
  if (s < HOUR) return `לפני ${Math.round(s / MIN)} דקות`;

  if (s < 2 * HOUR) {
    const extra = Math.round((s - HOUR) / MIN);
    if (extra <= 7) return "לפני שעה";
    if (extra <= 22) return "לפני שעה ורבע";
    if (extra <= 37) return "לפני שעה וחצי";
    if (extra <= 52) return "לפני שעה ושלושת רבעי";
    return "לפני שעתיים";
  }

  if (s < 12 * HOUR) {
    const h = Math.floor(s / HOUR);
    const m = Math.round((s % HOUR) / MIN);
    const head = h === 2 ? "שעתיים" : `${h} שעות`;
    if (m <= 7) return `לפני ${head}`;
    if (m >= 53) return `לפני ${h + 1 === 2 ? "שעתיים" : `${h + 1} שעות`}`;
    if (m <= 22) return `לפני ${head} ורבע`;
    if (m <= 37) return `לפני ${head} וחצי`;
    return `לפני ${head} ושלושת רבעי`;
  }

  const d = new Date(iso);
  const time = formatClock(d);
  if (isSameDay(d, now)) return `היום ב-${time}`;
  if (isYesterday(d, now)) return `אתמול ב-${time}`;
  if (s < 7 * DAY) return `ביום ${hebrewWeekday(d)} ב-${time}`;
  return `${d.getDate()}.${d.getMonth() + 1} ב-${time}`;
}

/** משך זמן קצר למספרים בטיימר: 7:32 או 1:07:32 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / HOUR);
  const m = Math.floor((s % HOUR) / MIN);
  const sec = s % MIN;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** משך זמן במילים: "שעה ו-20 דקות" */
export function durationHebrew(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < MIN) return `${s} שניות`;
  const h = Math.floor(s / HOUR);
  const m = Math.round((s % HOUR) / MIN);
  if (h === 0) return m === 1 ? "דקה" : `${m} דקות`;
  const head = h === 1 ? "שעה" : h === 2 ? "שעתיים" : `${h} שעות`;
  if (m === 0) return head;
  return `${head} ו-${m} דקות`;
}

export function formatClock(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isYesterday(d: Date, now: Date): boolean {
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  return isSameDay(d, y);
}

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export function hebrewWeekday(d: Date): string {
  return WEEKDAYS[d.getDay()];
}

/**
 * גיל התינוק בעברית: "בן 12 ימים" / "בן חודש ו-3 שבועות" / "בן שנה ו-2 חודשים"
 */
export function babyAgeHebrew(
  birthDate: string,
  sex: "male" | "female" | "unspecified" | null,
  now: Date = new Date(),
): string {
  const b = new Date(birthDate);
  const days = Math.floor((now.getTime() - b.getTime()) / (DAY * 1000));
  // כשהמין לא צוין לא ממציאים אותו — פשוט משמיטים את "בן/בת"
  const ben = sex === "female" ? "בת " : sex === "male" ? "בן " : "";

  if (days < 0) return "טרם נולד";
  if (days === 0) return "נולד היום";
  if (days === 1) return `${ben}יום`;
  if (days < 14) return `${ben}${days} ימים`;
  if (days < 60) {
    const weeks = Math.floor(days / 7);
    return `${ben}${weeks} שבועות`;
  }

  let months =
    (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;

  if (months < 24) return months === 1 ? `${ben}חודש` : `${ben}${months} חודשים`;

  const years = Math.floor(months / 12);
  const rem = months % 12;
  const yearPart = years === 2 ? "שנתיים" : `${years} שנים`;
  if (rem === 0) return `${ben}${yearPart}`;
  return `${ben}${yearPart} ו-${rem === 1 ? "חודש" : `${rem} חודשים`}`;
}
