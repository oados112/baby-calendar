import { zonedParts } from "@/lib/zoned";
import type { EventRow, EventType } from "@/types/db";

/**
 * קצב ההאכלות, לפי השעה ביום.
 *
 * השאלה האמיתית בשלוש לפנות בוקר אינה "מתי אכלה" אלא "מתי היא תרצה
 * שוב". הנתונים כבר קיימים — צריך רק להסתכל על המרווחים בין האכלות.
 *
 * **מספר אחד לכל היממה הוא שקר.** בלילה המרווח הוא חמש שעות ובבוקר
 * שעתיים וחצי; מי שממצע אותם מקבל שלוש וחצי, שאינו נכון באף אחד משני
 * הזמנים. לכן כל מרווח מקבל משקל לפי כמה השעה שבה הוא התחיל קרובה
 * לשעה שבה הייתה ההאכלה האחרונה.
 *
 * **משקל רציף ולא קטגוריות.** חלוקה ל"יום" ו"לילה" נשברת בדיוק
 * בגבול: האכלה של 23:00 והאכלה של 04:00 היו נופלות לאותה מחיצה, אף
 * שאחריהן באים מרווחים שונים לגמרי. פעמון סביב השעה הנוכחית נותן
 * לשעות הסמוכות את רוב המשקל ולרחוקות כמעט כלום, בלי שום קפיצה.
 *
 * **חציון ולא ממוצע.** לילה אחד שבו היא התעוררה פעמיים מיותרות לא
 * אמור להזיז את התחזית של שאר הלילות.
 *
 * **רישומים צמודים הם ארוחה אחת.** הנקה ומיד אחריה בקבוק השלמה, או
 * שני צדדים שנרשמו בנפרד, הם שניים-שלושה רישומים אבל האכלה אחת. כל
 * מה שנופל בתוך שעה מתקפל לארוחה אחת, והמרווח נמדד מסוף ארוחה אחת
 * לתחילת הבאה — אחרת כל צמד כזה היה מוסיף מרווח של רבע שעה ומושך את
 * כל הקצב כלפי מטה.
 */

const FEED_TYPES: EventType[] = ["feed_breast", "feed_bottle", "solids"];

/**
 * רישומים שמרחקם קטן מזה שייכים לאותה ארוחה.
 *
 * שעה ולא עשרים דקות: בפועל קורה שההנקה מסתיימת, עוברת חצי שעה,
 * ואז ניתן בקבוק השלמה. גם הנקה שנרשמה כשני רישומים נפרדים — צד
 * וצד — נופלת כאן.
 */
const SAME_MEAL_SEC = 60 * 60;
/** מעל לזה — כנראה יום שלא נרשם בו הכל, ולא מרווח אמיתי. */
const IMPLAUSIBLE_GAP_SEC = 12 * 3600;
/** רוחב הפעמון, בשעות. בערך מרווח אחד של האכלה ביום. */
const HOUR_SIGMA = 1.5;
/**
 * משקל מצטבר מינימלי כדי לסמוך על הפילוח לפי שעה — בערך שני ימים
 * של האכלות באותה שעה. מתחת לזה מוצג החציון הכללי.
 */
const MINIMUM_WEIGHT = 2;
/** פחות מזה בסך הכל אינו קצב אלא ניחוש. */
const MINIMUM_OVERALL = 4;

export interface FeedRhythm {
  /** המרווח האופייני לשעה הזו ביום, בשניות */
  gapSec: number;
  /** החציון על פני כל היממה — ההשוואה שמסבירה למה המספר שונה */
  overallGapSec: number;
  /** "בלילה" / "בבוקר" … או null כשאין מספיק נתונים לשעה הזו */
  timeOfDay: string | null;
  /** כמה מרווחים נכנסו לחישוב הכללי */
  samples: number;
  lastAt: Date;
  /** הערכה למתי תהיה ההאכלה הבאה */
  nextAt: Date;
}

/** שעה עשרונית לפי אזור הזמן של המשפחה: 23:30 → 23.5 */
function hourOf(ms: number, timeZone: string): number {
  const { hour, minute } = zonedParts(new Date(ms), timeZone);
  return hour + minute / 60;
}

/** מרחק על מעגל של 24 שעות: בין 23:30 ל-00:30 יש שעה, לא 23. */
function hourDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 24;
  return Math.min(d, 24 - d);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** החציון שבו כל ערך סופר לפי המשקל שלו ולא פעם אחת. */
function weightedMedian(entries: { value: number; weight: number }[]): number {
  const sorted = [...entries].sort((a, b) => a.value - b.value);
  const half = sorted.reduce((sum, e) => sum + e.weight, 0) / 2;

  let running = 0;
  for (const e of sorted) {
    running += e.weight;
    if (running >= half) return e.value;
  }

  return sorted[sorted.length - 1].value;
}

/** תווית לשעה, לתצוגה בלבד. */
function timeOfDayLabel(hour: number): string {
  if (hour >= 23 || hour < 6) return "בלילה";
  if (hour < 12) return "בבוקר";
  if (hour < 18) return "אחר הצהריים";
  return "בערב";
}

/** חותמות הזמן של ההאכלות בלבד, מהחדשה לישנה, בלי כפילויות. */
export function feedTimes(
  events: Pick<EventRow, "type" | "started_at" | "deleted_at">[],
): number[] {
  const seen = new Set<number>();

  for (const e of events) {
    if (e.deleted_at || !FEED_TYPES.includes(e.type)) continue;
    seen.add(new Date(e.started_at).getTime());
  }

  return [...seen].sort((a, b) => b - a);
}

interface Meal {
  /** הרישום המוקדם ביותר בארוחה */
  start: number;
  /** הרישום המאוחר ביותר בה — ממנו נמדדת ההמתנה לבאה */
  end: number;
}

/**
 * מקפל רישומים צמודים לארוחות.
 *
 * `times` מהחדש לישן, והתוצאה באותו סדר. רישום שנמצא בתוך שעה
 * מהרישום שלפניו מצטרף לאותה ארוחה — כולל שרשרת: הנקה, עוד הנקה
 * חצי שעה אחריה, ובקבוק חצי שעה אחריה הן ארוחה אחת של שעה.
 */
function toMeals(times: number[]): Meal[] {
  const meals: Meal[] = [];

  for (const t of times) {
    const current = meals[meals.length - 1];
    if (current && current.start - t <= SAME_MEAL_SEC * 1000) {
      current.start = t;
    } else {
      meals.push({ start: t, end: t });
    }
  }

  return meals;
}

/**
 * null כשאין מספיק היסטוריה — עדיף לא להציג כלום מאשר לנחש.
 *
 * `times` הן חותמות זמן של האכלות, מהחדשה לישנה.
 */
export function feedRhythm(times: number[], timeZone: string): FeedRhythm | null {
  if (times.length < MINIMUM_OVERALL + 1) return null;

  const meals = toMeals(times);
  if (meals.length < MINIMUM_OVERALL + 1) return null;

  // המרווח נמדד מסוף ארוחה אחת לתחילת הבאה, ונזכר יחד עם השעה שבה
  // הסתיימה הקודמת — כלומר שעת הרישום האחרון לפני ההמתנה. זו בדיוק
  // השאלה בזמן התחזית: אכלה ב-23:40, כמה זמן עד הבאה
  const gaps: { seconds: number; hour: number }[] = [];

  for (let i = 1; i < meals.length; i++) {
    const seconds = (meals[i - 1].start - meals[i].end) / 1000;
    if (seconds <= 0 || seconds > IMPLAUSIBLE_GAP_SEC) continue;
    gaps.push({ seconds, hour: hourOf(meals[i].end, timeZone) });
  }

  if (gaps.length < MINIMUM_OVERALL) return null;

  const overallGapSec = Math.round(median(gaps.map((g) => g.seconds)));
  // נקודת הייחוס היא הרישום האחרון בפועל, כמו בכרטיס "מאז"
  const lastAt = new Date(meals[0].end);
  const lastHour = hourOf(meals[0].end, timeZone);

  const weighted = gaps.map((g) => {
    const d = hourDistance(g.hour, lastHour);
    return {
      value: g.seconds,
      weight: Math.exp(-(d * d) / (2 * HOUR_SIGMA * HOUR_SIGMA)),
    };
  });

  const totalWeight = weighted.reduce((sum, e) => sum + e.weight, 0);
  const useHour = totalWeight >= MINIMUM_WEIGHT;

  const gapSec = useHour
    ? Math.round(weightedMedian(weighted))
    : overallGapSec;

  return {
    gapSec,
    overallGapSec,
    timeOfDay: useHour ? timeOfDayLabel(lastHour) : null,
    samples: gaps.length,
    lastAt,
    nextAt: new Date(lastAt.getTime() + gapSec * 1000),
  };
}
