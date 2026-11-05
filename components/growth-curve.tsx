"use client";

import { useState } from "react";
import {
  compactAge,
  growthSeries,
  INDICATOR_LABEL,
  INDICATOR_UNIT,
  MAX_AGE_DAYS,
  percentileToZ,
  REFERENCE_PERCENTILES,
  valueAtZ,
  type GrowthIndicator,
  type GrowthPoint,
  type GrowthSex,
} from "@/lib/growth";
import { longDate } from "@/lib/zoned";
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
 *
 * **הנקודות נלחצות.** ה-title של SVG מופיע רק בריחוף, כלומר בטלפון
 * אף פעם. לחיצה על נקודה פותחת מתחת לגרף את הפרטים המלאים של אותה
 * שקילה, ושטח המגע גדול בהרבה מהנקודה הנראית — נקודה ברדיוס ארבעה
 * פיקסלים אי אפשר לפגוע באגודל.
 */

/** אותם אחוזונים שבטבלה ובפנקס, מומרים לסטיות תקן מדויקות. */
const BAND_Z = REFERENCE_PERCENTILES.map(percentileToZ);

const W = 320;
const H = 190;
const PAD_X = 36;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;
/** שטח המגע סביב כל נקודה, ברדיוס. גדול בהרבה מהנקודה הנראית. */
const HIT_R = 15;

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

  // המדידה האחרונה פתוחה כברירת מחדל: הגרף אומר משהו כבר במבט
  // הראשון, בלי שצריך ללחוץ כדי שיהיה בו מידע
  const [selected, setSelected] = useState(points.length - 1);

  if (points.length === 0) return null;

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

  const unit = INDICATOR_UNIT[indicator];
  const decimals = indicator === "weight" ? 3 : 1;
  const active = points[selected] ?? points[points.length - 1];

  return (
    <figure className="mt-3 mb-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-manipulation"
        role="img"
        aria-label={`${INDICATOR_LABEL[indicator]} מול תקן WHO`}
      >
        <title>
          {INDICATOR_LABEL[indicator]} מול עקומות הייחוס של ארגון הבריאות העולמי
        </title>

        {/* רצועות הייחוס, מהרחבה לצרה — אחוזונים 3–97 ואז 15–85 */}
        <path d={bandPath(bands[0], bands[4])} fill="var(--ev-growth)" opacity="0.08" />
        <path d={bandPath(bands[1], bands[3])} fill="var(--ev-growth)" opacity="0.12" />

        <path
          d={linePath(bands[2])}
          fill="none"
          stroke="var(--ev-growth)"
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.5"
        />

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

        {/* קו אנכי שמחבר את הנקודה הפתוחה לפרטים שמתחת לגרף */}
        <line
          x1={x(active.ageDays)}
          x2={x(active.ageDays)}
          y1={y(active.value)}
          y2={H - PAD_BOTTOM + 4}
          stroke="var(--ev-growth)"
          strokeWidth="1"
          strokeDasharray="2 2"
          opacity="0.45"
        />

        {points.map((p, i) => (
          <g
            key={p.at}
            role="button"
            tabIndex={0}
            aria-label={describe(p, unit, decimals)}
            aria-pressed={i === selected}
            onClick={() => setSelected(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelected(i);
              }
            }}
            className="cursor-pointer focus:outline-none"
          >
            {/* מעגל שקוף ורחב: זה מה שהאצבע פוגעת בו */}
            <circle cx={x(p.ageDays)} cy={y(p.value)} r={HIT_R} fill="transparent" />
            <circle
              cx={x(p.ageDays)}
              cy={y(p.value)}
              r={i === selected ? 5.5 : 4}
              fill="var(--ev-growth)"
              stroke="var(--surface-card)"
              strokeWidth={i === selected ? 2.5 : 2}
            />
            <title>{describe(p, unit, decimals)}</title>
          </g>
        ))}

        <text x={W - PAD_X} y={H - 7} textAnchor="end" fontSize="9" fill="var(--text-faint)">
          לידה
        </text>
        <text x={PAD_X} y={H - 7} textAnchor="start" fontSize="9" fill="var(--text-faint)">
          {monthsLabel(maxAge)}
        </text>
      </svg>

      {/* גובה קבוע: מעבר בין נקודות לא אמור להקפיץ את מה שמתחת */}
      <figcaption
        aria-live="polite"
        className="mt-2 min-h-[4.5rem] rounded-md bg-surface-sunken px-3 py-2.5"
      >
        <span className="tnum block text-[0.9375rem] font-semibold text-strong">
          {active.value.toFixed(decimals)} {unit} · אחוזון{" "}
          {Math.round(active.percentile)}
        </span>
        <span className="tnum block text-[0.8125rem] text-muted">
          {fullDate(active.at)}
        </span>
        <span className="block text-[0.75rem] text-faint">
          {compactAge(active.ageDays)}
          {active.ageDays > 0 ? ` · ${active.ageDays} ימים` : ""}
          {points.length > 1 ? " · לחיצה על נקודה בגרף מציגה שקילה אחרת" : ""}
        </span>
      </figcaption>

      <p className="mt-2 text-[0.75rem] leading-relaxed text-faint">
        הרצועות הן אחוזוני WHO ל{sex === "female" ? "בנות" : "בנים"} — הבהירה 3 עד
        97, הכהה 15 עד 85, והקו המקווקו הוא החציון.
      </p>
    </figure>
  );
}

/** "יום שלישי, 3 בנובמבר 2026" — עם השנה, כי מדידות נפרשות על שנתיים. */
function fullDate(at: string): string {
  const key = at.slice(0, 10);
  return `${longDate(key)} ${key.slice(0, 4)}`;
}

function describe(p: GrowthPoint, unit: string, decimals: number): string {
  return `${fullDate(p.at)} · ${p.value.toFixed(decimals)} ${unit} · אחוזון ${Math.round(p.percentile)}`;
}

function monthsLabel(days: number): string {
  const months = Math.round(days / 30.4375);
  if (months <= 1) return "חודש";
  if (months === 2) return "חודשיים";
  return `${months} חודשים`;
}
