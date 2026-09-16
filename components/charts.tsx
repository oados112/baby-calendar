/**
 * גרפים.
 *
 * כתובים כ-SVG ישיר ולא בספריית גרפים: שליטה מלאה ב-RTL, בטוקני הצבע
 * ובנגישות, ואפס משקל נוסף בטעינה.
 *
 * כללי העיצוב שחוזרים בכולם:
 *  • סדרה אחת לכל גרף. הכותרת מזהה אותה, ולכן אין מקרא ואין ריבוי צבעים.
 *  • הצבע הוא צבע סוג האירוע — אותו ירוק/כתול בכל מסך באתר.
 *  • צירים וקווי עזר עדינים; המספרים עצמם על העמודות ולא על ציר נפרד.
 *  • כל עמודה נושאת <title>, כך שיש גם tooltip וגם קריאה במסך קורא.
 */

export type ChartTone = "feed" | "sleep" | "diaper" | "growth" | "health" | "activity";

const TONE_VAR: Record<ChartTone, string> = {
  feed: "var(--ev-feed)",
  sleep: "var(--ev-sleep)",
  diaper: "var(--ev-diaper)",
  growth: "var(--ev-growth)",
  health: "var(--ev-health)",
  activity: "var(--ev-activity)",
};

export interface BarDatum {
  /** תווית מתחת לעמודה */
  label: string;
  value: number;
  /** מה שיוצג על העמודה ובתיאור; ברירת מחדל: הערך עצמו */
  display?: string;
  title?: string;
  /** מדגיש עמודה אחת (למשל היום הנוכחי) */
  emphasis?: boolean;
}

/** נתיב מלבן עם פינות עליונות מעוגלות, מעוגן לקו הבסיס. */
function barPath(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.min(r, w / 2, Math.max(0, h));
  if (h <= 0) return "";
  return [
    `M${x},${y + h}`,
    `V${y + radius}`,
    `a${radius},${radius} 0 0 1 ${radius},${-radius}`,
    `h${w - 2 * radius}`,
    `a${radius},${radius} 0 0 1 ${radius},${radius}`,
    `V${y + h}`,
    "Z",
  ].join(" ");
}

export function BarChart({
  data,
  tone,
  height = 132,
  emptyLabel = "אין נתונים בתקופה הזו",
}: {
  data: BarDatum[];
  tone: ChartTone;
  height?: number;
  emptyLabel?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 0);
  if (max === 0) {
    return (
      <p className="py-6 text-center text-[0.8125rem] text-faint">{emptyLabel}</p>
    );
  }

  const W = 320;
  const padTop = 18;
  const padBottom = 18;
  const plot = height - padTop - padBottom;
  const slot = W / data.length;
  // 2px רווח בין עמודות סמוכות, כדי שהן ייקראו כנפרדות
  const barWidth = Math.min(28, slot - 8);
  const color = TONE_VAR[tone];

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      className="h-auto w-full"
      role="img"
    >
      {/* קו בסיס עדין — מספיק כדי לעגן את העין, בלי רשת מלאה */}
      <line
        x1="0"
        x2={W}
        y1={padTop + plot}
        y2={padTop + plot}
        stroke="var(--border-subtle)"
        strokeWidth="1"
      />

      {data.map((d, i) => {
        // RTL: העמודה הראשונה בימין
        const x = W - (i + 1) * slot + (slot - barWidth) / 2;
        const h = d.value <= 0 ? 0 : Math.max(3, (d.value / max) * plot);
        const y = padTop + plot - h;

        return (
          <g key={d.label + i}>
            <title>{d.title ?? `${d.label}: ${d.display ?? d.value}`}</title>
            <path
              d={barPath(x, y, barWidth, h, 4)}
              fill={color}
              opacity={d.emphasis === false ? 0.55 : 1}
            />
            {d.value > 0 ? (
              <text
                x={x + barWidth / 2}
                y={y - 5}
                textAnchor="middle"
                className="tnum"
                fontSize="10.5"
                fill="var(--text-muted)"
              >
                {d.display ?? d.value}
              </text>
            ) : null}
            <text
              x={x + barWidth / 2}
              y={height - 5}
              textAnchor="middle"
              fontSize="10.5"
              fill="var(--text-faint)"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * מפת שינה — שורה ליום, עמודה לשעה.
 *
 * סקאלה סדרתית: גוון אחד, מבהיר לכהה לפי עוצמה. לא קשת צבעים —
 * בקשת אי אפשר לדעת איזה צבע "יותר".
 */
export function SleepHeatmap({
  rows,
  rowLabels,
}: {
  rows: number[][];
  rowLabels: string[];
}) {
  const hours = 24;
  // מידות שנבחרו כך שיממה שלמה נכנסת לרוחב טלפון בלי גלילה צדדית
  const cell = 9.5;
  const gap = 2;
  const labelW = 14;
  const W = labelW + hours * (cell + gap);
  const H = rows.length * (cell + gap) + 13;

  const hasData = rows.some((r) => r.some((v) => v > 0));

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="מפת שעות שינה לפי יום"
      >
        {rows.map((row, r) =>
          row.map((minutes, h) => {
            // RTL: שעה 0 בימין
            const x = W - labelW - (h + 1) * (cell + gap) + gap;
            const y = r * (cell + gap);
            const intensity = Math.min(1, minutes / 60);
            return (
              <rect
                key={`${r}-${h}`}
                x={x}
                y={y}
                width={cell}
                height={cell}
                rx="3"
                fill={intensity > 0 ? "var(--ev-sleep)" : "var(--surface-sunken)"}
                opacity={intensity > 0 ? 0.25 + intensity * 0.75 : 1}
              >
                <title>
                  {rowLabels[r]} · {String(h).padStart(2, "0")}:00 ·{" "}
                  {minutes > 0 ? `${Math.round(minutes)} דק׳ שינה` : "ער/ה"}
                </title>
              </rect>
            );
          }),
        )}

        {rowLabels.map((label, r) => (
          <text
            key={label + r}
            x={W}
            y={r * (cell + gap) + cell - 1}
            textAnchor="end"
            fontSize="8.5"
            fill="var(--text-muted)"
          >
            {label}
          </text>
        ))}

        {[0, 6, 12, 18].map((h) => (
          <text
            key={h}
            x={W - labelW - (h + 1) * (cell + gap) + gap + cell / 2}
            y={H - 3}
            textAnchor="middle"
            fontSize="8"
            fill="var(--text-faint)"
          >
            {String(h).padStart(2, "0")}
          </text>
        ))}
      </svg>

      {!hasData ? (
        <p className="pt-2 text-center text-[0.8125rem] text-faint">
          עדיין אין שינה מתועדת עם שעת סיום
        </p>
      ) : null}
    </div>
  );
}

/** מספר בודד עם כותרת — כשהתשובה היא מספר אחד, גרף רק מפריע. */
export function StatTile({
  label,
  value,
  unit,
  tone,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: ChartTone;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-subtle bg-surface-card px-3 py-3">
      <div className="flex items-center gap-1.5">
        {tone ? (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ background: TONE_VAR[tone] }}
          />
        ) : null}
        <span className="text-[0.75rem] text-muted">{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="tnum text-[1.375rem] leading-none font-semibold text-strong">
          {value}
        </span>
        {unit ? <span className="text-[0.75rem] text-muted">{unit}</span> : null}
      </div>
      {hint ? <p className="mt-1 text-[0.6875rem] text-faint">{hint}</p> : null}
    </div>
  );
}
