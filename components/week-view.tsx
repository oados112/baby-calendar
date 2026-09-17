import { PageNav } from "@/components/page-nav";
import { GrowthPanel } from "@/components/growth-panel";
import { BarChart, SleepHeatmap, StatTile, type BarDatum } from "@/components/charts";
import { averageOf, formatHours, type DaySummary } from "@/lib/stats";
import { shortDate, weekdayShort } from "@/lib/zoned";
import type { EventRow } from "@/types/db";

/**
 * תצוגה שבועית.
 *
 * המטרה כאן אינה לספור — הספירה נמצאת בתצוגה היומית. המטרה היא לראות
 * *מגמה*: האם השינה מתארכת, האם ההאכלות מתייצבות, מתי הלילה מתפרק.
 * לכן כל גרף הוא מדד אחד לאורך שבעה ימים, ולא ערבוב של מדדים.
 */
export function WeekView({
  days,
  heatmap,
  todayKey,
  growth,
  birthWeightG,
}: {
  days: DaySummary[];
  heatmap: number[][];
  todayKey: string;
  /** מדידות גדילה לכל הזמנים */
  growth: EventRow[];
  birthWeightG: number | null;
}) {
  const labels = days.map((d) => weekdayShort(d.key));

  const bars = (
    pick: (d: DaySummary) => number,
    display?: (v: number) => string,
  ): BarDatum[] =>
    days.map((d) => {
      const value = pick(d);
      return {
        label: weekdayShort(d.key),
        value,
        display: value > 0 ? (display ? display(value) : String(value)) : undefined,
        title: `${weekdayShort(d.key)} ${shortDate(d.key)}: ${
          display ? display(value) : value
        }`,
        // היום הנוכחי עדיין חלקי, ולכן מוצג עמום — אחרת הוא נראה כמו ירידה
        emphasis: d.key !== todayKey,
      };
    });

  const avgFeeds = averageOf(days.map((d) => d.feeds));
  const avgSleep = averageOf(days.map((d) => d.sleepMinutes));
  const avgDiapers = averageOf(days.map((d) => d.diapers));
  const avgMl = averageOf(days.map((d) => d.bottleMl));

  const nothing = days.every(
    (d) => d.feeds === 0 && d.diapers === 0 && d.sleepMinutes === 0,
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col pt-[calc(1rem+var(--safe-top))]">
      <PageNav />

      <main id="main" className="flex-1 px-4 pb-10">
        <h1 className="mb-1 text-[1.0625rem] font-semibold text-strong">
          שבעת הימים האחרונים
        </h1>
        <p className="mb-4 text-[0.8125rem] text-muted">
          הממוצעים מתעלמים מימים ללא רישום, והיום הנוכחי מוצג עמום כי הוא עדיין
          לא נגמר.
        </p>

        {nothing ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-12 text-center text-[0.9375rem] leading-relaxed text-muted">
            עוד אין מספיק נתונים למגמות.
            <br />
            אחרי יום-יומיים של רישום זה יתחיל להיות מעניין.
          </p>
        ) : (
          <>
            <section aria-label="ממוצעים" className="grid grid-cols-2 gap-2">
              <StatTile
                label="האכלות ביום"
                tone="feed"
                value={avgFeeds > 0 ? avgFeeds.toFixed(1) : "—"}
                hint={avgMl > 0 ? `${Math.round(avgMl)} מ״ל בממוצע` : undefined}
              />
              <StatTile
                label="שינה ביום"
                tone="sleep"
                value={avgSleep > 0 ? formatHours(avgSleep) : "—"}
              />
              <StatTile
                label="חיתולים ביום"
                tone="diaper"
                value={avgDiapers > 0 ? avgDiapers.toFixed(1) : "—"}
              />
              <StatTile
                label="שינה רצופה"
                tone="sleep"
                value={
                  Math.max(...days.map((d) => d.longestSleepMinutes)) > 0
                    ? formatHours(Math.max(...days.map((d) => d.longestSleepMinutes)))
                    : "—"
                }
                hint="הארוכה ביותר השבוע"
              />
            </section>

            <Panel title="האכלות ביום">
              <BarChart data={bars((d) => d.feeds)} tone="feed" />
            </Panel>

            <Panel title="שעות שינה ביום">
              <BarChart
                data={bars(
                  (d) => Math.round(d.sleepMinutes),
                  (v) => (v / 60).toFixed(1),
                )}
                tone="sleep"
              />
            </Panel>

            <Panel title="חיתולים ביום">
              <BarChart data={bars((d) => d.diapers)} tone="diaper" />
            </Panel>

            {days.some((d) => d.bottleMl > 0) ? (
              <Panel title="מ״ל בבקבוק ביום">
                <BarChart data={bars((d) => d.bottleMl)} tone="feed" />
              </Panel>
            ) : null}

            <Panel
              title="מתי ישנים"
              subtitle="כל ריבוע הוא שעה. ככל שכהה יותר — כך ישנו בה יותר."
            >
              <SleepHeatmap rows={heatmap} rowLabels={labels} />
            </Panel>
          </>
        )}

        <GrowthPanel events={growth} birthWeightG={birthWeightG} />
      </main>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 rounded-lg border border-subtle bg-surface-card p-3.5">
      <h2 className="text-[0.9375rem] font-semibold text-strong">{title}</h2>
      {subtitle ? (
        <p className="mt-0.5 mb-1 text-[0.75rem] text-muted">{subtitle}</p>
      ) : null}
      <div className="mt-2">{children}</div>
    </section>
  );
}
