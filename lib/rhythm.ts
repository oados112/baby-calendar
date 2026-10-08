import type { EventRow, EventType } from "@/types/db";

/**
 * קצב ההאכלות.
 *
 * השאלה האמיתית בשלוש לפנות בוקר אינה "מתי אכלה" אלא "מתי היא תרצה
 * שוב". הנתונים כבר קיימים — צריך רק להסתכל על המרווחים בין האכלות.
 *
 * **חציון ולא ממוצע.** שנת לילה אחת של שש שעות מושכת ממוצע של תשע
 * האכלות בשעה וחצי קדימה, והתחזית יוצאת שגויה כל היום. החציון לא זז.
 *
 * **מרווחים קצרים מאוד מושמטים.** בקבוק השלמה מיד אחרי הנקה הוא שני
 * רישומים אבל ארוחה אחת; אילו נספר, הקצב היה נראה כפול ממה שהוא.
 */

const FEED_TYPES: EventType[] = ["feed_breast", "feed_bottle", "solids"];

/** מתחת לזה — השלמה לאותה ארוחה ולא ארוחה חדשה. */
const SAME_MEAL_SEC = 20 * 60;
/** מעל לזה — כנראה יום שלא נרשם בו הכל, ולא מרווח אמיתי. */
const IMPLAUSIBLE_GAP_SEC = 12 * 3600;
/** כמה מרווחים לוקחים בחשבון. יומיים-שלושה של האכלות. */
const WINDOW = 12;
/** פחות מזה אינו קצב אלא ניחוש. */
const MINIMUM_SAMPLES = 4;

export interface FeedRhythm {
  /** המרווח האופייני, בשניות */
  gapSec: number;
  /** על כמה מרווחים הוא נשען */
  samples: number;
  lastAt: Date;
  /** הערכה למתי תהיה ההאכלה הבאה */
  nextAt: Date;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** null כשאין מספיק היסטוריה — עדיף לא להציג כלום מאשר לנחש. */
export function feedRhythm(events: EventRow[]): FeedRhythm | null {
  const feeds = events
    .filter((e) => !e.deleted_at && FEED_TYPES.includes(e.type))
    .map((e) => new Date(e.started_at).getTime())
    .sort((a, b) => b - a);

  if (feeds.length < MINIMUM_SAMPLES + 1) return null;

  const gaps: number[] = [];
  for (let i = 1; i < feeds.length && gaps.length < WINDOW; i++) {
    const gap = (feeds[i - 1] - feeds[i]) / 1000;
    if (gap >= SAME_MEAL_SEC && gap <= IMPLAUSIBLE_GAP_SEC) gaps.push(gap);
  }

  if (gaps.length < MINIMUM_SAMPLES) return null;

  const gapSec = Math.round(median(gaps));
  const lastAt = new Date(feeds[0]);

  return {
    gapSec,
    samples: gaps.length,
    lastAt,
    nextAt: new Date(lastAt.getTime() + gapSec * 1000),
  };
}
