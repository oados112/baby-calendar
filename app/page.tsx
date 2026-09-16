"use client";

import { useMemo, useState } from "react";
import { SinceCard } from "@/components/since-card";
import {
  IconActivity,
  IconBottle,
  IconBreast,
  IconDiaper,
  IconGrowth,
  IconMedicine,
  IconNote,
  IconPlus,
  IconSleep,
  IconSolids,
  IconTemp,
} from "@/components/icons";
import { DEMO_MEMBER_NAMES, getDemoBaby, getDemoEvents } from "@/lib/demo-data";
import { EVENT_META, FAMILY_CLASSES, summarizeEvent } from "@/lib/event-meta";
import { babyAgeHebrew, durationHebrew, formatClock } from "@/lib/time";
import type { EventRow, EventType } from "@/types/db";

/** האירוע האחרון מכל סוג. */
function lastOf(events: EventRow[], types: EventType[]): EventRow | null {
  const match = events
    .filter((e) => types.includes(e.type) && !e.deleted_at)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
  return match[0] ?? null;
}

const QUICK_ACTIONS: {
  type: EventType;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}[] = [
  { type: "feed_breast", label: "הנקה", icon: IconBreast },
  { type: "feed_bottle", label: "בקבוק", icon: IconBottle },
  { type: "diaper", label: "חיתול", icon: IconDiaper },
  { type: "sleep", label: "שינה", icon: IconSleep },
  { type: "solids", label: "מוצקים", icon: IconSolids },
  { type: "temperature", label: "חום", icon: IconTemp },
  { type: "medicine", label: "תרופה", icon: IconMedicine },
  { type: "growth", label: "מדידה", icon: IconGrowth },
  { type: "note", label: "הערה", icon: IconNote },
];

export default function HomePage() {
  const events = getDemoEvents();
  const baby = getDemoBaby();
  const [openSheet, setOpenSheet] = useState<EventType | null>(null);

  const lastFeed = useMemo(
    () => lastOf(events, ["feed_breast", "feed_bottle", "solids"]),
    [events],
  );
  const lastSleep = useMemo(() => lastOf(events, ["sleep"]), [events]);
  const lastDiaper = useMemo(() => lastOf(events, ["diaper"]), [events]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      {/* כותרת */}
      <header className="flex items-center justify-between gap-3 px-4 pt-[calc(1rem+var(--safe-top))] pb-3">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-accent-soft text-lg font-semibold text-accent-text">
            {baby.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-lg leading-tight font-semibold text-strong">
              {baby.name}
            </h1>
            <p className="text-[0.8125rem] text-muted">
              {babyAgeHebrew(baby.birth_date, baby.sex)}
            </p>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1 px-4 pb-32">
        {/* מבט חטוף — התשובה ל"מתי לאחרונה?" */}
        <section aria-label="מצב נוכחי" className="grid grid-cols-3 gap-2.5">
          <SinceCard
            title="האכלה"
            family="feed"
            icon={IconBottle}
            lastAt={lastFeed?.started_at ?? null}
            detail={lastFeed ? summarizeEvent(lastFeed.type, lastFeed.data) : null}
            dueAfterHours={2.5}
            lateAfterHours={4}
          />
          <SinceCard
            title="שינה"
            family="sleep"
            icon={IconSleep}
            lastAt={lastSleep?.started_at ?? null}
            detail={
              lastSleep?.ended_at
                ? durationHebrew(
                    (new Date(lastSleep.ended_at).getTime() -
                      new Date(lastSleep.started_at).getTime()) /
                      1000,
                  )
                : null
            }
            dueAfterHours={2}
            lateAfterHours={3.5}
          />
          <SinceCard
            title="חיתול"
            family="diaper"
            icon={IconDiaper}
            lastAt={lastDiaper?.started_at ?? null}
            detail={lastDiaper ? summarizeEvent("diaper", lastDiaper.data) : null}
            dueAfterHours={3}
            lateAfterHours={5}
          />
        </section>

        {/* היום */}
        <section aria-label="היום" className="mt-7">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="text-[0.9375rem] font-semibold text-strong">היום</h2>
            <span className="text-[0.8125rem] text-muted">
              {events.length} רישומים
            </span>
          </div>

          <ol className="relative space-y-1">
            {/* קו הזמן */}
            <span
              aria-hidden
              className="absolute top-2 bottom-2 end-[1.375rem] w-px bg-subtle"
            />
            {events.map((e) => (
              <TimelineRow key={e.id} event={e} />
            ))}
          </ol>
        </section>
      </main>

      {/* פעולות מהירות — באזור האגודל */}
      <nav
        aria-label="רישום מהיר"
        className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-lg border-t border-subtle bg-surface-raised/95 px-3 pt-2.5 pb-[calc(0.75rem+var(--safe-bottom))] backdrop-blur"
        style={{ boxShadow: "var(--shadow-sheet)" }}
      >
        <div className="grid grid-cols-5 gap-1.5">
          {QUICK_ACTIONS.slice(0, 4).map((a) => (
            <QuickButton
              key={a.type}
              {...a}
              onClick={() => setOpenSheet(a.type)}
            />
          ))}
          <QuickButton
            type="note"
            label="עוד"
            icon={IconPlus}
            onClick={() => setOpenSheet("note")}
          />
        </div>
      </nav>

      {openSheet && (
        <PlaceholderSheet type={openSheet} onClose={() => setOpenSheet(null)} />
      )}
    </div>
  );
}

function QuickButton({
  type,
  label,
  icon: Icon,
  onClick,
}: {
  type: EventType;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  onClick: () => void;
}) {
  const colors = FAMILY_CLASSES[EVENT_META[type].family];
  return (
    <button
      onClick={onClick}
      className="flex min-h-tap-comfy flex-col items-center justify-center gap-1 rounded-md py-2 transition-transform duration-150 active:scale-95"
    >
      <span
        className={`grid size-9 place-items-center rounded-full ${colors.soft} ${colors.text}`}
      >
        <Icon className="size-5" />
      </span>
      <span className="text-[0.6875rem] font-medium text-muted">{label}</span>
    </button>
  );
}

function TimelineRow({ event }: { event: EventRow }) {
  const meta = EVENT_META[event.type];
  const colors = FAMILY_CLASSES[meta.family];
  const summary = summarizeEvent(event.type, event.data);
  const duration =
    event.ended_at &&
    durationHebrew(
      (new Date(event.ended_at).getTime() - new Date(event.started_at).getTime()) / 1000,
    );

  return (
    <li className="relative flex items-start gap-3 rounded-md py-2 ps-1 pe-1">
      <div className="min-w-0 flex-1 order-2">
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
          <span className="text-faint">·</span>
          <span className="text-faint">{DEMO_MEMBER_NAMES[event.created_by]}</span>
        </div>
        {event.note ? (
          <p className="mt-1 text-[0.8125rem] text-default">{event.note}</p>
        ) : null}
      </div>

      {/* הנקודה על קו הזמן */}
      <span
        className={`order-3 grid size-9 shrink-0 place-items-center rounded-full ${colors.soft} ${colors.text} ring-4 ring-[var(--surface-base)]`}
      >
        <IconFor type={event.type} />
      </span>

    </li>
  );
}

function IconFor({ type }: { type: EventType }) {
  const map: Partial<Record<EventType, React.ComponentType<React.SVGProps<SVGSVGElement>>>> =
    {
      feed_breast: IconBreast,
      feed_bottle: IconBottle,
      diaper: IconDiaper,
      sleep: IconSleep,
      solids: IconSolids,
      temperature: IconTemp,
      medicine: IconMedicine,
      growth: IconGrowth,
      activity: IconActivity,
      milestone: IconActivity,
    };
  const C = map[type] ?? IconNote;
  return <C className="size-4.5" />;
}

/** חלונית זמנית — כאן ייכנסו טפסי הרישום האמיתיים בשלב הבא. */
function PlaceholderSheet({
  type,
  onClose,
}: {
  type: EventType;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`רישום ${EVENT_META[type].label}`}
    >
      <button
        aria-label="סגירה"
        onClick={onClose}
        className="absolute inset-0 bg-[var(--surface-overlay)]"
      />
      <div className="relative mx-auto w-full max-w-lg rounded-t-xl border border-subtle bg-surface-raised p-5 pb-[calc(1.5rem+var(--safe-bottom))]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <h2 className="text-lg font-semibold text-strong">
          רישום {EVENT_META[type].label}
        </h2>
        <p className="mt-2 text-[0.9375rem] text-muted">
          טופס הרישום ייבנה בשלב הבא. כרגע זו תצוגה מקדימה של המסך הראשי.
        </p>
        <button
          onClick={onClose}
          className="mt-5 min-h-tap-comfy w-full rounded-lg bg-accent text-[1rem] font-semibold text-on-accent transition-transform duration-150 active:scale-[0.985]"
        >
          סגירה
        </button>
      </div>
    </div>
  );
}
