import Link from "next/link";
import { PageNav } from "@/components/page-nav";
import { StatTile } from "@/components/charts";
import { EVENT_META, FAMILY_CLASSES, summarizeEvent } from "@/lib/event-meta";
import { durationHebrew, formatClock } from "@/lib/time";
import { formatHours, type DaySummary } from "@/lib/stats";
import { longDate, shiftDayKey } from "@/lib/zoned";
import type { EventRow } from "@/types/db";

/**
 * תצוגה יומית.
 *
 * רכיב שרת: אין כאן אינטראקציה חוץ מקישורי ניווט, אז אין סיבה לשלוח
 * לדפדפן קוד. המעבר בין ימים הוא קישור אמיתי — כפתור "אחורה" בדפדפן
 * עובד, ואפשר לשמור או לשתף קישור ליום מסוים.
 */
export function DayView({
  dayKey,
  todayKey,
  summary,
  events,
  memberNames,
}: {
  dayKey: string;
  todayKey: string;
  summary: DaySummary;
  events: EventRow[];
  memberNames: Record<string, string>;
}) {
  const prev = shiftDayKey(dayKey, -1);
  const next = shiftDayKey(dayKey, 1);
  const isToday = dayKey === todayKey;
  const isFuture = dayKey >= todayKey;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col pt-[calc(1rem+var(--safe-top))]">
      <PageNav />

      <header className="mb-4 flex items-center gap-2 px-4">
        {/* RTL: "אחורה בזמן" הוא החץ שמצביע ימינה */}
        <Link
          href={`/journal?date=${prev}`}
          aria-label="היום הקודם"
          className="grid size-11 shrink-0 place-items-center rounded-md border border-subtle bg-surface-card text-default"
        >
          ›
        </Link>

        <div className="flex-1 text-center">
          <h1 className="text-[1.0625rem] font-semibold text-strong">
            {isToday ? "היום" : longDate(dayKey)}
          </h1>
          {isToday ? (
            <p className="text-[0.8125rem] text-muted">{longDate(dayKey)}</p>
          ) : (
            <Link
              href="/journal"
              className="text-[0.8125rem] text-accent-text underline-offset-2 hover:underline"
            >
              חזרה להיום
            </Link>
          )}
        </div>

        {isFuture ? (
          <span className="size-11 shrink-0" aria-hidden />
        ) : (
          <Link
            href={`/journal?date=${next}`}
            aria-label="היום הבא"
            className="grid size-11 shrink-0 place-items-center rounded-md border border-subtle bg-surface-card text-default"
          >
            ‹
          </Link>
        )}
      </header>

      <main id="main" className="flex-1 px-4 pb-10">
        <section aria-label="סיכום היום" className="grid grid-cols-3 gap-2">
          <StatTile
            label="האכלות"
            tone="feed"
            value={String(summary.feeds)}
            hint={
              summary.bottleMl > 0 ? `${summary.bottleMl} מ״ל בבקבוק` : undefined
            }
          />
          <StatTile
            label="שינה"
            tone="sleep"
            value={summary.sleepMinutes > 0 ? formatHours(summary.sleepMinutes) : "—"}
            hint={
              summary.longestSleepMinutes > 0
                ? `הארוכה: ${formatHours(summary.longestSleepMinutes)}`
                : undefined
            }
          />
          <StatTile
            label="חיתולים"
            tone="diaper"
            value={String(summary.diapers)}
            hint={
              summary.diapers > 0
                ? `${summary.pee} פיפי · ${summary.poo} קקי`
                : undefined
            }
          />
        </section>

        <section aria-label="רישומי היום" className="mt-6">
          <h2 className="mb-2.5 text-[0.9375rem] font-semibold text-strong">
            כל הרישומים
          </h2>

          {events.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-[0.9375rem] text-muted">
              {isFuture ? "היום עוד לא התחיל." : "לא נרשם דבר ביום הזה."}
            </p>
          ) : (
            <ol className="relative space-y-1">
              <span
                aria-hidden
                className="absolute top-2 bottom-2 end-[1.375rem] w-px bg-subtle"
              />
              {events.map((e) => (
                <Row key={e.id} event={e} memberNames={memberNames} />
              ))}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}

function Row({
  event,
  memberNames,
}: {
  event: EventRow;
  memberNames: Record<string, string>;
}) {
  const meta = EVENT_META[event.type];
  const colors = FAMILY_CLASSES[meta.family];
  const summary = summarizeEvent(event.type, event.data);
  const duration =
    event.ended_at &&
    durationHebrew(
      (new Date(event.ended_at).getTime() - new Date(event.started_at).getTime()) / 1000,
    );

  return (
    <li className="relative flex items-start gap-3 rounded-md px-1 py-2">
      <div className="order-2 min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[0.9375rem] font-medium text-strong">{meta.label}</span>
          {duration ? (
            <span className="tnum text-[0.8125rem] text-muted">{duration}</span>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.8125rem] text-muted">
          <span className="tnum">{formatClock(new Date(event.started_at))}</span>
          {summary ? (
            <>
              <span className="text-faint">·</span>
              <span>{summary}</span>
            </>
          ) : null}
          {memberNames[event.created_by] ? (
            <>
              <span className="text-faint">·</span>
              <span className="text-faint">{memberNames[event.created_by]}</span>
            </>
          ) : null}
        </div>
        {event.note ? (
          <p className="mt-1 text-[0.8125rem] text-default">{event.note}</p>
        ) : null}
      </div>

      <span
        aria-hidden
        className={`order-3 mt-1 size-3 shrink-0 rounded-full ${colors.dot} ring-4 ring-[var(--surface-base)]`}
      />
    </li>
  );
}
