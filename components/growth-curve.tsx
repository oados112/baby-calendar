import {
  growthSeries,
  INDICATOR_LABEL,
  INDICATOR_UNIT,
  MAX_AGE_DAYS,
  valueAtZ,
  type GrowthIndicator,
  type GrowthSex,
} from "@/lib/growth";
import { shortDate } from "@/lib/zoned";
import type { EventRow } from "@/types/db";

/**
 * עקומת גדילה מול תקן WHO.
 *
 * **למה רצועות ולא רק מספר.** "אחוזון 47" הוא נקודה אחת; מה שרופא
 * מסתכל עליו הוא האם הקו *נשאר באותו מקום*. תינוקת שעברה מאחוזון 60
 * ל-25 בתוך חודש מעניינת גם אם שני המספרים "תקינים", ותינוקת שצמודה
 * לאחוזון 12 לאורך שנה לא מעניינת בכלל. הרצועות הופכות את זה למשהו
 * שרואים במבט, בלי לקרוא מספרים.
 *
 * **הצבע כאן אינו קטגורי.** הרצועות הן רקע סדרתי — ככל שמתרחקים
 * מהחציון הגוון מתעבה — והקו שלה הוא הנתון היחיד שנושא זהות. לכן
 * גוון אחד לרצועות ברמות שקיפות שונות, וצבע הגדילה של האתר לקו.
 */

/** z של אחוזון 3, 15, 50, 85, 97 — הרצועות שמופיעות בפנקס. */
const BAND_Z = [-1.881, -1.036, 0, 1.036, 1.881];

const W = 320;
const H = 190;
const PAD_X = 36;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;

export function GrowthCurve({
  events,
  birthDate,
  sex,
  indicator,
}: {
  events: EventRow[];
  birthDate: string;
  sex: GrowthSex;
  indicator: GrowthIndicator;
}) {
  const points = growthSeries(events, birthDate, sex, indicator);
  if (points.length === 0) return null;

  // טווח הגילים: מהלידה ועד קצת אחרי המדידה האחרונה, כדי שהנקודה
  // האחרונה לא תידבק לקצה
  const lastAge = points[points.length - 1].ageDays;
  const maxAge = Math.min(MAX_AGE_DAYS, Math.max(60, Math.ceil(lastAge * 1.15)));

  // דגימת הרצועות: עשרים ושתיים עמודות מספיקות לעקומה חלקה ברוחב הזה
  const steps = 22;
  const ages = Array.from({ length: steps + 1 }, (_, i) =>
    Math.round((i / steps) * maxAge),
  );

  const bands = BAND_Z.map((z) =>
    ages.map((age) => valueAtZ(sex, indicator, age, z) ?? 0),
  );

  const all = [...bands.flat(), ...points.map((p) => p.value)];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = Math.max(0.1, hi - lo);

  // RTL: הזמן זורם מימין לשמאל, כמו בשאר הגרפים באתר
  const x = (age: number) => W - PAD_X - (age / maxAge) * (W - PAD_X * 2);
  const y = (value: number) =>
    PAD_TOP + (1 - (value - lo + span * 0.06) / (span * 1.12)) * (H - PAD_TOP - PAD_BOTTOM);

  /** רצועה בין שתי עקומות z, כמצולע סגור. */
  const bandPath = (lower: number[], upper: number[]) =>
    [
      ...ages.map((age, i) => `${i === 0 ? "M" : "L"}${x(age).toFixed(1)},${y(lower[i]).toFixed(1)}`),
      ...[...ages].reverse().map((age, i) => {
        const j = ages.length - 1 - i;
        return `L${x(age).toFixed(1)},${y(upper[j]).toFixed(1)}`;
      }),
      "Z",
    ].join(" ");

  const linePath = (values: number[]) =>
    ages
      .map((age, i) => `${i === 0 ? "M" : "L"}${x(age).toFixed(1)},${y(values[i]).toFixed(1)}`)
      .join(" ");

  const measured = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.ageDays).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");

  const latest = points[points.length - 1];
  const unit = INDICATOR_UNIT[indicator];
  const decimals = indicator === "weight" ? 3 : 1;

  return (
    <figure className="mt-3 mb-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${INDICATOR_LABEL[indicator]} מול תקן WHO`}
      >
        <title>
          {INDICATOR_LABEL[indicator]} מול עקומות הייחוס של ארגון הבריאות העולמי
        </title>

        {/* רצועות הייחוס, מהרחבה לצרה — אחוזונים 3–97 ואז 15–85 */}
        <path d={bandPath(bands[0], bands[4])} fill="var(--ev-growth)" opacity="0.08" />
        <path d={bandPath(bands[1], bands[3])} fill="var(--ev-growth)" opacity="0.12" />

        {/* החציון */}
        <path
          d={linePath(bands[2])}
          fill="none"
          stroke="var(--ev-growth)"
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.5"
        />

        {/* תוויות הרצועות על הקצה השמאלי, שם הקווים הכי מרוחקים זה מזה */}
        {[
          { i: 4, label: "97" },
          { i: 2, label: "50" },
          { i: 0, label: "3" },
        ].map(({ i, label }) => (
          <text
            key={label}
            x={PAD_X - 4}
            y={y(bands[i][steps]) + 3}
            textAnchor="end"
            fontSize="8"
            fill="var(--text-faint)"
          >
            {label}
          </text>
        ))}

        {/* המדידות שלה */}
        {points.length > 1 ? (
          <path
            d={measured}
            fill="none"
            stroke="var(--ev-growth)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {points.map((p) => (
          <circle
            key={p.at}
            cx={x(p.ageDays)}
            cy={y(p.value)}
            r="4"
            fill="var(--ev-growth)"
            // טבעת בצבע הרקע: מפרידה את הנקודה מהרצועה שמתחתיה
            stroke="var(--surface-card)"
            strokeWidth="2"
          >
            {/* מחרוזת אחת, ותאריך שאינו תלוי באזור הזמן של המכשיר —
                אחרת ההידרציה נשברת והעמוד נבנה מחדש בדפדפן */}
            <title>
              {`${shortDate(p.at.slice(0, 10))} · ${p.value.toFixed(decimals)} ${unit} · אחוזון ${Math.round(p.percentile)}`}
            </title>
          </circle>
        ))}

        {/* ציר הגיל: רק שני הקצוות, כי זה כל מה שצריך כדי לקרוא אותו */}
        <text x={W - PAD_X} y={H - 7} textAnchor="end" fontSize="9" fill="var(--text-faint)">
          לידה
        </text>
        <text x={PAD_X} y={H - 7} textAnchor="start" fontSize="9" fill="var(--text-faint)">
          {monthsLabel(maxAge)}
        </text>
      </svg>

      <figcaption className="mt-1 text-[0.75rem] leading-relaxed text-faint">
        הרצועות הן אחוזוני WHO ל{sex === "female" ? "בנות" : "בנים"} — הבהירה 3 עד
        97, הכהה 15 עד 85, והקו המקווקו הוא החציון. המדידה האחרונה:{" "}
        <span className="tnum">
          {latest.value.toFixed(decimals)} {unit}
        </span>
        .
      </figcaption>
    </figure>
  );
}

function monthsLabel(days: number): string {
  const months = Math.round(days / 30.4375);
  if (months <= 1) return "חודש";
  if (months === 2) return "חודשיים";
  return `${months} חודשים`;
}
