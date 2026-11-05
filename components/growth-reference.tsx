"use client";

import { useEffect, useRef } from "react";
import {
  MAX_AGE_DAYS,
  percentileToZ,
  referenceRows,
  REFERENCE_PERCENTILES,
  INDICATOR_UNIT,
  valueAtZ,
  weeksAndDays,
  type GrowthIndicator,
  type GrowthSex,
} from "@/lib/growth";

/**
 * טבלת הייחוס של WHO: שורה לשבוע, עמודה לאחוזון.
 *
 * זו הטבלה שמודפסת בפנקס, רק שאפשר לקרוא ממנה מספר במקום להעריך
 * אותו מתוך גרף. השאלה שהיא עונה עליה היא "כמה היא צריכה לשקול בשבוע
 * הבא כדי להישאר באותו אחוזון" — שאלה שאי אפשר לענות עליה מהעקומה.
 *
 * מאה וחמש שורות הן יותר ממה שנכנס למסך, ולכן גלילה פנימית עם כותרת
 * דביקה: בלי הכותרת, אחרי עשר שורות כבר לא זוכרים איזו עמודה היא 50.
 *
 * **השורה של השבוע הנוכחי מסומנת ונגללת למרכז.** בלי זה צריך לחפש
 * אותה בין מאה שורות בכל כניסה, וככל שהיא גדלה היא יורדת נמוך יותר.
 */
export function GrowthReference({
  sex,
  indicator,
  currentAgeDays,
}: {
  sex: GrowthSex;
  indicator: GrowthIndicator;
  /** הגיל המדויק בימים — מחושב בשרת כדי שלא יהיה הבדל בהידרציה */
  currentAgeDays: number;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const current = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    const box = scroller.current;
    const row = current.current;
    if (!box || !row) return;

    // גלילה של המיכל בלבד, לא של הדף: scrollIntoView היה מזיז גם את
    // העמוד כולו ומקפיץ את המשתמש למקום אחר
    box.scrollTop = Math.max(
      0,
      row.offsetTop - box.clientHeight / 2 + row.offsetHeight / 2,
    );
  }, [currentAgeDays]);

  const decimals = indicator === "weight" ? 3 : 1;

  /**
   * שורות השבועות, ובתוכן שורת "היום".
   *
   * בלי שורת היום הטבלה מטעה: היא בת 54 יום, שורת "שבוע 7" היא יום
   * 49, והחציון עולה כעשרים ותשעה גרם ליום — כלומר אותו משקל בדיוק
   * שווה כתשעה אחוזונים פחות. השורה הזו היא הערך האמיתי להיום.
   */
  const weeks = referenceRows(sex, indicator);
  const todayValues =
    currentAgeDays >= 0 && currentAgeDays <= MAX_AGE_DAYS
      ? REFERENCE_PERCENTILES.map((p) =>
          valueAtZ(sex, indicator, currentAgeDays, percentileToZ(p)),
        )
      : null;

  const onWeekBoundary = currentAgeDays % 7 === 0;
  const rows: {
    key: string;
    label: string;
    sub: string | null;
    values: number[];
    today: boolean;
  }[] = [];

  for (const row of weeks) {
    rows.push({
      key: `w${row.week}`,
      label: String(row.week),
      sub: `יום ${row.ageDays}`,
      values: row.values,
      today: onWeekBoundary && row.ageDays === currentAgeDays,
    });

    // נכנסת מיד אחרי השבוע שקדם לה, במקום הנכון על ציר הזמן
    if (
      !onWeekBoundary &&
      todayValues &&
      currentAgeDays > row.ageDays &&
      currentAgeDays < row.ageDays + 7
    ) {
      rows.push({
        key: "today",
        label: "היום",
        sub: weeksAndDays(currentAgeDays),
        values: todayValues as number[],
        today: true,
      });
    }
  }

  return (
    <section className="mt-5">
      <h3 className="text-[0.875rem] font-semibold text-strong">
        טבלת האחוזונים לפי שבוע
      </h3>
      <p className="mt-0.5 mb-2 text-[0.75rem] leading-relaxed text-muted">
        המשקל ב{INDICATOR_UNIT[indicator]} שמתאים לכל אחוזון, לפי תקן WHO.
        כל שורה היא שבוע מלא — שבוע 7 הוא יום 49 — והשורה המסומנת היא
        הגיל המדויק שלה היום.
      </p>

      <div
        ref={scroller}
        className="max-h-80 overflow-y-auto rounded-md border border-subtle"
      >
        <table className="w-full border-collapse text-[0.8125rem]">
          <thead className="sticky top-0 z-10 bg-surface-card">
            <tr>
              <th
                scope="col"
                className="border-b border-line px-2 py-2 text-start text-[0.75rem] font-medium text-faint"
              >
                שבוע
              </th>
              {REFERENCE_PERCENTILES.map((p) => (
                <th
                  key={p}
                  scope="col"
                  className="tnum border-b border-line px-1.5 py-2 text-end text-[0.75rem] font-medium text-faint"
                >
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isNow = row.today;
              return (
                <tr
                  key={row.key}
                  ref={isNow ? current : undefined}
                  aria-current={isNow ? "true" : undefined}
                  className={isNow ? "bg-accent-soft" : undefined}
                >
                  <th
                    scope="row"
                    className={[
                      "border-b border-subtle px-2 py-1.5 text-start font-normal",
                      isNow ? "font-semibold text-accent-text" : "text-muted",
                    ].join(" ")}
                  >
                    <span className="tnum">{row.label}</span>
                    {row.sub ? (
                      <span className="tnum block text-[0.6875rem] text-faint">
                        {row.sub}
                      </span>
                    ) : null}
                  </th>
                  {row.values.map((v, i) => (
                    <td
                      key={REFERENCE_PERCENTILES[i]}
                      className={[
                        "tnum border-b border-subtle px-1.5 py-1.5 text-end",
                        // החציון הוא העמודה שקוראים אליה, אז היא בולטת
                        REFERENCE_PERCENTILES[i] === 50
                          ? "font-semibold text-strong"
                          : "text-default",
                      ].join(" ")}
                    >
                      {v.toFixed(decimals)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
