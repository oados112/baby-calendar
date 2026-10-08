/**
 * מקטעי הנקה.
 *
 * כל קטע הוא "צד X, מהשעה הזו עד השעה הזו". זה המודל הנכון כי הוא עונה
 * על שתי שאלות שהסכום לבדו לא ענה עליהן:
 *
 *   **מתי התחילה בשד השני?** קודם ידענו רק "שמאל 8 דקות, ימין 6 דקות",
 *   בלי לדעת מתי כל צד התחיל.
 *
 *   **כמה באמת ינקה?** הפסקה של שלוש דקות באמצע נספרה כזמן הנקה.
 *   עכשיו היא פשוט הרווח בין שני קטעים, ולא נספרת.
 *
 * כל הפונקציות כאן טהורות — אותו קלט תמיד נותן אותה תוצאה, והן משמשות
 * גם את הטיימר על המסך וגם את חישוב הסיכום בשמירה.
 */

export type NursingSide = "left" | "right";

export interface NursingSegment {
  side: NursingSide;
  /** ISO */
  from: string;
  /** ISO. חסר בקטע שרץ כרגע */
  to?: string | null;
}

export function parseSegments(value: unknown): NursingSegment[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (s): s is NursingSegment =>
      typeof s === "object" &&
      s !== null &&
      (s as NursingSegment).side !== undefined &&
      typeof (s as NursingSegment).from === "string",
  );
}

/** הקטע שרץ כרגע, אם יש. */
export function openSegment(segments: NursingSegment[]): NursingSegment | null {
  const last = segments[segments.length - 1];
  return last && !last.to ? last : null;
}

export function isPaused(segments: NursingSegment[]): boolean {
  return segments.length > 0 && openSegment(segments) === null;
}

/** סוגר את הקטע הפתוח. אם אין פתוח — מחזיר כמו שהוא. */
export function closeSegment(
  segments: NursingSegment[],
  at: Date = new Date(),
): NursingSegment[] {
  const open = openSegment(segments);
  if (!open) return segments;

  return segments.map((s, i) =>
    i === segments.length - 1 ? { ...s, to: at.toISOString() } : s,
  );
}

/** פותח קטע חדש, אחרי סגירת הקודם. */
export function startSegment(
  segments: NursingSegment[],
  side: NursingSide,
  at: Date = new Date(),
): NursingSegment[] {
  return [...closeSegment(segments, at), { side, from: at.toISOString() }];
}

/** סך השניות בכל צד. קטע פתוח נספר עד `now`. */
export function totals(
  segments: NursingSegment[],
  now: Date = new Date(),
): { left: number; right: number; total: number } {
  let left = 0;
  let right = 0;

  for (const s of segments) {
    const from = new Date(s.from).getTime();
    const to = s.to ? new Date(s.to).getTime() : now.getTime();
    const seconds = Math.max(0, (to - from) / 1000);

    if (s.side === "left") left += seconds;
    else right += seconds;
  }

  return { left: Math.round(left), right: Math.round(right), total: Math.round(left + right) };
}

/** מתי התחילה לראשונה בכל צד — זה מה שחסר קודם. */
export function firstStartPerSide(
  segments: NursingSegment[],
): { left: string | null; right: string | null } {
  const left = segments.find((s) => s.side === "left")?.from ?? null;
  const right = segments.find((s) => s.side === "right")?.from ?? null;
  return { left, right };
}

/** כמה שניות של הפסקה היו באמצע. */
export function pausedSeconds(segments: NursingSegment[]): number {
  let total = 0;

  for (let i = 1; i < segments.length; i++) {
    const previousEnd = segments[i - 1].to;
    if (!previousEnd) continue;
    const gap =
      (new Date(segments[i].from).getTime() - new Date(previousEnd).getTime()) / 1000;
    if (gap > 0) total += gap;
  }

  return Math.round(total);
}

/** מה שנשמר על האירוע בסיום. */
export function toEventData(
  segments: NursingSegment[],
  now: Date = new Date(),
): Record<string, unknown> {
  const closed = closeSegment(segments, now);
  const sums = totals(closed, now);
  const firsts = firstStartPerSide(closed);

  return {
    // left_sec / right_sec נשמרים גם כדי שסיכומים וגרפים קיימים
    // ימשיכו לעבוד בלי שינוי
    left_sec: sums.left,
    right_sec: sums.right,
    last_side: closed[closed.length - 1]?.side ?? null,
    left_started_at: firsts.left,
    right_started_at: firsts.right,
    paused_sec: pausedSeconds(closed),
    segments: closed,
  };
}

/**
 * מזיז את כל הקטעים באותו הפרש.
 *
 * משמש כשמגלים שהטיימר הופעל באיחור: הסשן כולו התחיל מוקדם יותר, אבל
 * המבנה שלו — מתי הוחלף צד, איפה הייתה הפסקה — נכון כמו שהוא. הזזה
 * אחידה שומרת עליו ומתקנת רק את נקודת האפס.
 */
export function shiftSegments(
  segments: NursingSegment[],
  deltaMs: number,
): NursingSegment[] {
  const move = (iso: string) => new Date(new Date(iso).getTime() + deltaMs).toISOString();

  return segments.map((s) => ({
    ...s,
    from: move(s.from),
    to: s.to ? move(s.to) : s.to,
  }));
}
