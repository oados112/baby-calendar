import {
  weeksAndDays,
  growthSeries,
  growthZ,
  zToPercentile,
  type GrowthSex,
} from "@/lib/growth";
import { shortDate } from "@/lib/zoned";
import type { EventRow } from "@/types/db";

/**
 * טבלת השקילות.
 *
 * העקומה מראה את התמונה במבט; הטבלה נותנת את המספרים שמקריאים לרופא.
 * שתיהן מאותם נתונים, וזה בכוונה — ברגע שצריך לומר "היא הייתה
 * באחוזון 16 בלידה ועכשיו 37", צריך את המספרים ולא את הצורה.
 *
 * **עמודת השינוי היא העיקר.** אחוזון בודד אומר מעט; מה שמעניין הוא
 * הכיוון. ירידה עקבית בין שקילות היא מה שרופא מחפש, וקשה לראות אותה
 * כשצריך לחסר בראש בין שורות.
 */
export function GrowthTable({
  events,
  birthDate,
  sex,
  birthWeightG,
}: {
  events: EventRow[];
  birthDate: string;
  sex: GrowthSex;
  birthWeightG: number | null;
}) {
  const series = growthSeries(events, birthDate, sex, "weight");

  // משקל הלידה נרשם כאירוע גדילה כשהוקמה המשפחה, אבל לא תמיד —
  // אם הוא קיים רק בפרטי התינוק/ת, מוסיפים אותו כשורה ראשונה
  const hasBirthRow = series.some((p) => p.ageDays <= 0);
  const rows = [...series];

  if (!hasBirthRow && birthWeightG) {
    const value = birthWeightG / 1000;
    const z = growthZ(sex, "weight", 0, value);
    if (z !== null) {
      rows.unshift({
        at: `${birthDate.slice(0, 10)}T00:00:00.000Z`,
        ageDays: 0,
        value,
        z,
        percentile: zToPercentile(z),
      });
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-[0.8125rem]">
        <caption className="mb-1.5 text-start text-[0.8125rem] font-medium text-default">
          השקילות עד היום
        </caption>
        <thead>
          <tr className="text-[0.75rem] text-faint">
            <th scope="col" className="border-b border-line py-1.5 text-start font-medium">
              תאריך
            </th>
            <th scope="col" className="border-b border-line py-1.5 text-start font-medium">
              גיל
            </th>
            <th scope="col" className="border-b border-line py-1.5 text-end font-medium">
              משקל
            </th>
            <th scope="col" className="border-b border-line py-1.5 text-end font-medium">
              אחוזון
            </th>
            <th scope="col" className="border-b border-line py-1.5 text-end font-medium">
              שינוי
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => {
            const previous = i > 0 ? rows[i - 1] : null;
            const delta = previous
              ? Math.round(p.percentile) - Math.round(previous.percentile)
              : null;

            return (
              <tr key={p.at}>
                <td className="tnum border-b border-subtle py-2 text-start text-muted">
                  {shortDate(p.at.slice(0, 10))}
                </td>
                <td className="border-b border-subtle py-2 text-start text-muted">
                  {weeksAndDays(p.ageDays)}
                </td>
                <td className="tnum border-b border-subtle py-2 text-end text-strong">
                  {p.value.toFixed(3)}
                </td>
                <td className="tnum border-b border-subtle py-2 text-end font-semibold text-strong">
                  {Math.round(p.percentile)}
                </td>
                <td className="tnum border-b border-subtle py-2 text-end text-muted">
                  {delta === null ? "—" : delta === 0 ? "ללא שינוי" : signed(delta)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-2 text-[0.75rem] leading-relaxed text-faint">
        המשקל בק״ג. עמודת השינוי היא ההפרש באחוזון מהשקילה הקודמת —
        תזוזה קטנה בין שקילות היא רגילה, ומה שעוקבים אחריו הוא מגמה.
      </p>
    </div>
  );
}

/** "‎+4" / "‎−7" — עם מינוס אמיתי ולא מקף. */
function signed(delta: number): string {
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}
