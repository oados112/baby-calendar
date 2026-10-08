import Link from "next/link";
import { PageNav } from "@/components/page-nav";
import { DayEvents } from "@/components/day-events";
import { DayPicker } from "@/components/day-picker";
import { StatTile } from "@/components/charts";
import { formatHours, type DaySummary } from "@/lib/stats";
import { longDate, shiftDayKey } from "@/lib/zoned";
import type { EventRow } from "@/types/db";

/**
 * תצוגה יומית.
 *
 * רכיב שרת: רק רשימת הרישומים אינטראקטיבית ויורדת ללקוח. המעבר בין
 * ימים הוא קישור אמיתי — כפתור "אחורה" בדפדפן עובד, ואפשר לשמור או
 * לשתף קישור ליום מסוים.
 */
export function DayView({
  dayKey,
  todayKey,
  summary,
  events,
  memberNames,
  currentUserId,
  familyId,
  birthDate,
}: {
  dayKey: string;
  todayKey: string;
  summary: DaySummary;
  events: EventRow[];
  memberNames: Record<string, string>;
  currentUserId: string;
  familyId: string;
  /** אין יומן לפני הלידה — תאריכים מוקדמים יותר כבויים בלוח */
  birthDate?: string;
}) {
  const prev = shiftDayKey(dayKey, -1);
  const next = shiftDayKey(dayKey, 1);
  const isToday = dayKey === todayKey;
  const isFuture = dayKey >= todayKey;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col pt-[calc(1rem+var(--safe-top))]">
      <PageNav />

      <header className="mb-4 flex items-center gap-2 px-4">
        <Link
          href={`/journal?date=${prev}`}
          // טעינה מראש: היום הקודם מוכן ברקע עוד לפני הלחיצה
          prefetch
          aria-label="היום הקודם"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-subtle bg-surface-card text-default transition-transform duration-150 active:scale-90"
        >
          <Chevron direction="back" />
        </Link>

        <div className="flex-1 text-center">
          <h1>
            <DayPicker dayKey={dayKey} todayKey={todayKey} minKey={birthDate} />
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
            prefetch
            aria-label="היום הבא"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-subtle bg-surface-card text-default transition-transform duration-150 active:scale-90"
          >
            <Chevron direction="forward" />
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

          <DayEvents
            events={events}
            memberNames={memberNames}
            currentUserId={currentUserId}
            familyId={familyId}
            emptyLabel={isFuture ? "היום עוד לא התחיל." : "לא נרשם דבר ביום הזה."}
          />
        </section>
      </main>
    </div>
  );
}

/**
 * חץ מעבר בין ימים.
 *
 * SVG ולא התו "›": תווי הסוגר האלה מראה-תמונה בכיוון RTL, כלומר החץ
 * של "היום הקודם" הוצג הפוך. SVG לא מתהפך, והכיוון נשאר מה שנכתב —
 * ובעברית "אחורה בזמן" מצביע ימינה.
 */
function Chevron({ direction }: { direction: "back" | "forward" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-4"
    >
      <path d={direction === "back" ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} />
    </svg>
  );
}
