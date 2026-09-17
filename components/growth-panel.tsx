import { StatTile } from "@/components/charts";
import type { EventRow } from "@/types/db";

/**
 * מעקב גדילה.
 *
 * מה שמוצג כאן הוא **המדידות שלכם בלבד** — אין כאן עקומות אחוזונים.
 * זו החלטה מכוונת ולא חוסר: טבלאות האחוזונים של WHO תלויות במין ובגיל
 * מדויק, ופרסום מספרים לא מאומתים לצד משקל של תינוק אמיתי מזיק יותר
 * ממה שהוא מועיל. עקומות ייתווספו כשיהיו לנו נתוני ייחוס מאומתים.
 *
 * מה כן מוצג, וזה מה שבאמת עוקבים אחריו בשבועות הראשונים:
 *  • המשקל לאורך זמן
 *  • **קצב העלייה בגרמים ליום** בין שתי מדידות
 *  • מתי חזר למשקל הלידה — אבן הדרך של השבועיים הראשונים
 */

interface Measurement {
  at: string;
  weightG: number | null;
  heightCm: number | null;
  headCm: number | null;
}

function toMeasurements(events: EventRow[]): Measurement[] {
  return events
    .filter((e) => e.type === "growth" && !e.deleted_at)
    .map((e) => {
      const d = (e.data ?? {}) as Record<string, unknown>;
      const n = (k: string) => (typeof d[k] === "number" ? (d[k] as number) : null);
      return {
        at: e.started_at,
        weightG: n("weight_g"),
        heightCm: n("height_cm"),
        headCm: n("head_cm"),
      };
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

export function GrowthPanel({
  events,
  birthWeightG,
}: {
  events: EventRow[];
  birthWeightG: number | null;
}) {
  const measurements = toMeasurements(events);
  const weights = measurements.filter(
    (m): m is Measurement & { weightG: number } => m.weightG !== null,
  );

  if (weights.length === 0) {
    return (
      <section className="mt-5 rounded-lg border border-subtle bg-surface-card p-3.5">
        <h2 className="text-[0.9375rem] font-semibold text-strong">גדילה</h2>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
          עדיין אין מדידות משקל. אפשר לרשום דרך &rdquo;עוד&ldquo; ואז
          &rdquo;מדידה&ldquo;.
        </p>
      </section>
    );
  }

  const latest = weights[weights.length - 1];
  const previous = weights.length > 1 ? weights[weights.length - 2] : null;

  // קצב העלייה מחושב מול המדידה הקודמת, ולא מהלידה — זה מה שמשקף את
  // המצב הנוכחי, במיוחד אחרי הירידה הטבעית של הימים הראשונים
  const gainPerDay =
    previous && daysBetween(previous.at, latest.at) >= 0.5
      ? (latest.weightG - previous.weightG) / daysBetween(previous.at, latest.at)
      : null;

  const sinceBirth = birthWeightG ? latest.weightG - birthWeightG : null;
  const regainedAt =
    birthWeightG !== null
      ? (weights.find((w) => w.weightG >= birthWeightG)?.at ?? null)
      : null;

  const latestHeight = [...measurements].reverse().find((m) => m.heightCm !== null);
  const latestHead = [...measurements].reverse().find((m) => m.headCm !== null);

  return (
    <section className="mt-5 rounded-lg border border-subtle bg-surface-card p-3.5">
      <h2 className="text-[0.9375rem] font-semibold text-strong">גדילה</h2>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <StatTile
          label="משקל אחרון"
          tone="growth"
          value={(latest.weightG / 1000).toFixed(3)}
          unit="ק״ג"
          hint={
            sinceBirth !== null
              ? `${sinceBirth >= 0 ? "+" : "−"}${Math.abs(sinceBirth)} גרם מהלידה`
              : undefined
          }
        />
        <StatTile
          label="קצב עלייה"
          tone="growth"
          value={gainPerDay !== null ? `${gainPerDay >= 0 ? "+" : "−"}${Math.abs(Math.round(gainPerDay))}` : "—"}
          unit={gainPerDay !== null ? "גרם ליום" : undefined}
          hint={gainPerDay === null ? "צריך שתי מדידות" : "מאז המדידה הקודמת"}
        />
        {latestHeight ? (
          <StatTile
            label="אורך"
            tone="growth"
            value={String(latestHeight.heightCm)}
            unit="ס״מ"
          />
        ) : null}
        {latestHead ? (
          <StatTile
            label="היקף ראש"
            tone="growth"
            value={String(latestHead.headCm)}
            unit="ס״מ"
          />
        ) : null}
      </div>

      {birthWeightG !== null && regainedAt ? (
        <p className="mt-3 rounded-md bg-ok-soft px-3 py-2 text-[0.8125rem] text-ok">
          חזר/ה למשקל הלידה תוך{" "}
          {Math.max(1, Math.round(daysBetween(weights[0].at, regainedAt)))} ימים
        </p>
      ) : null}

      <WeightChart points={weights} birthWeightG={birthWeightG} />

      <p className="mt-3 text-[0.75rem] leading-relaxed text-faint">
        אלה המדידות שלכם בלבד, בלי עקומות אחוזונים. השוואה לאחוזונים נעשית
        בטיפת חלב.
      </p>
    </section>
  );
}

/** גרף קו פשוט: משקל לאורך זמן, עם קו ייחוס למשקל הלידה. */
function WeightChart({
  points,
  birthWeightG,
}: {
  points: (Measurement & { weightG: number })[];
  birthWeightG: number | null;
}) {
  if (points.length < 2) return null;

  const W = 320;
  const H = 150;
  const padX = 34;
  const padTop = 12;
  const padBottom = 22;

  const values = points.map((p) => p.weightG);
  if (birthWeightG !== null) values.push(birthWeightG);

  const min = Math.min(...values);
  const max = Math.max(...values);
  // ריפוד של 5% כדי שהקו לא ייגע בקצוות
  const span = Math.max(1, max - min);
  const lo = min - span * 0.05;
  const hi = max + span * 0.05;

  const t0 = new Date(points[0].at).getTime();
  const t1 = new Date(points[points.length - 1].at).getTime();
  const timeSpan = Math.max(1, t1 - t0);

  // RTL: הזמן זורם מימין לשמאל, כמו בשאר הגרפים באתר
  const x = (at: string) =>
    W - padX - ((new Date(at).getTime() - t0) / timeSpan) * (W - padX * 2);
  const y = (grams: number) =>
    padTop + (1 - (grams - lo) / (hi - lo)) * (H - padTop - padBottom);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.at).toFixed(1)},${y(p.weightG).toFixed(1)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-auto w-full" role="img">
      <title>משקל לאורך זמן</title>

      {birthWeightG !== null ? (
        <>
          <line
            x1={padX}
            x2={W - padX}
            y1={y(birthWeightG)}
            y2={y(birthWeightG)}
            stroke="var(--border-default)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <text
            x={W - padX}
            y={y(birthWeightG) - 4}
            textAnchor="end"
            fontSize="9"
            fill="var(--text-faint)"
          >
            משקל לידה
          </text>
        </>
      ) : null}

      <path
        d={path}
        fill="none"
        stroke="var(--ev-growth)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {points.map((p) => (
        <circle
          key={p.at}
          cx={x(p.at)}
          cy={y(p.weightG)}
          r="3.5"
          fill="var(--ev-growth)"
          stroke="var(--surface-card)"
          strokeWidth="2"
        >
          <title>
            {new Date(p.at).toLocaleDateString("he-IL")} · {(p.weightG / 1000).toFixed(3)}{" "}
            ק״ג
          </title>
        </circle>
      ))}

      <text x={W - padX} y={H - 6} textAnchor="end" fontSize="9" fill="var(--text-faint)">
        {new Date(points[0].at).toLocaleDateString("he-IL", {
          day: "numeric",
          month: "numeric",
        })}
      </text>
      <text x={padX} y={H - 6} textAnchor="start" fontSize="9" fill="var(--text-faint)">
        {new Date(points[points.length - 1].at).toLocaleDateString("he-IL", {
          day: "numeric",
          month: "numeric",
        })}
      </text>
    </svg>
  );
}
