"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SinceCard } from "@/components/since-card";
import { Sheet } from "@/components/sheet";
import { TimerPanel } from "@/components/timer-panel";
import { PageNav } from "@/components/page-nav";
import {
  BottleForm,
  DiaperForm,
  GrowthForm,
  SimpleForm,
  TemperatureForm,
} from "@/components/log-forms";
import {
  IconActivity,
  IconBaby,
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
import { babyDisplayName, babyInitial, newbornAge } from "@/lib/baby";
import { EVENT_META, FAMILY_CLASSES, summarizeEvent } from "@/lib/event-meta";
import { babyAgeHebrew, durationHebrew, formatClock } from "@/lib/time";
import { startTimer } from "@/lib/data/log";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ActiveTimerRow, EventRow, EventType } from "@/types/db";

export interface DashboardBaby {
  id: string;
  name: string | null;
  birth_date: string;
  birth_time: string | null;
  sex: "male" | "female" | "unspecified" | null;
}

export interface DashboardProps {
  baby: DashboardBaby;
  events: EventRow[];
  timers: ActiveTimerRow[];
  /** שם להצגה לכל user_id, כדי לתייג "מי רשם" */
  memberNames: Record<string, string>;
  /** מצב תצוגה עם נתוני דוגמה — הכתיבה מושבתת */
  demo?: boolean;
}

/** האירוע האחרון מבין סוגים נתונים. */
function lastOf(events: EventRow[], types: EventType[]): EventRow | null {
  return (
    events
      .filter((e) => types.includes(e.type) && !e.deleted_at)
      .sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null
  );
}

const ICONS: Partial<Record<EventType, React.ComponentType<React.SVGProps<SVGSVGElement>>>> =
  {
    feed_breast: IconBreast,
    feed_bottle: IconBottle,
    pump: IconBreast,
    solids: IconSolids,
    drink: IconBottle,
    diaper: IconDiaper,
    sleep: IconSleep,
    temperature: IconTemp,
    medicine: IconMedicine,
    vaccine: IconMedicine,
    doctor: IconMedicine,
    growth: IconGrowth,
    activity: IconActivity,
    milestone: IconActivity,
  };

function IconFor({ type, className }: { type: EventType; className?: string }) {
  const C = ICONS[type] ?? IconNote;
  return <C className={className ?? "size-4.5"} />;
}

/** מה שמופיע בחלונית "עוד". */
const MORE_ACTIONS: EventType[] = [
  "solids",
  "pump",
  "temperature",
  "medicine",
  "growth",
  "activity",
  "milestone",
  "note",
];

export function Dashboard({
  baby,
  events,
  timers,
  memberNames,
  demo = false,
}: DashboardProps) {
  const router = useRouter();
  const [sheet, setSheet] = useState<EventType | "more" | "breast_start" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const initial = babyInitial(baby.name);
  const lastFeed = useMemo(
    () => lastOf(events, ["feed_breast", "feed_bottle", "solids"]),
    [events],
  );
  const lastSleep = useMemo(() => lastOf(events, ["sleep"]), [events]);
  const lastDiaper = useMemo(() => lastOf(events, ["diaper"]), [events]);
  const lastBottle = useMemo(() => lastOf(events, ["feed_bottle"]), [events]);

  const sleepRunning = timers.some((t) => t.type === "sleep");
  const breastRunning = timers.some((t) => t.type === "feed_breast");

  // סנכרון חי: מה שההורה השני רושם מופיע כאן תוך שנייה, בלי רענון
  useEffect(() => {
    if (demo) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`baby-${baby.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: `baby_id=eq.${baby.id}` },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "active_timers", filter: `baby_id=eq.${baby.id}` },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [baby.id, demo, router]);

  function refresh() {
    setSheet(null);
    router.refresh();
  }

  async function guard(fn: () => Promise<unknown>) {
    if (busy) return;
    if (demo) {
      setToast("זו תצוגה לדוגמה — הרישום יעבוד אחרי ההתחברות");
      return;
    }
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "הפעולה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="flex items-center justify-between gap-3 px-4 pt-[calc(1rem+var(--safe-top))] pb-3">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-accent-soft text-lg font-semibold text-accent-text">
            {initial ?? <IconBaby className="size-6" />}
          </div>
          <div>
            <h1 className="text-lg leading-tight font-semibold text-strong">
              {babyDisplayName(baby.name)}
            </h1>
            <p className="text-[0.8125rem] text-muted" suppressHydrationWarning>
              {newbornAge(baby.birth_date, baby.birth_time) ??
                babyAgeHebrew(baby.birth_date, baby.sex)}
            </p>
          </div>
        </div>
      </header>

      <PageNav />

      <main id="main" className="flex-1 px-4 pb-32">
        <TimerPanel
          babyId={baby.id}
          timers={timers}
          onChange={refresh}
          onError={setToast}
        />

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

        <section aria-label="היום" className="mt-7">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="text-[0.9375rem] font-semibold text-strong">היום</h2>
            <span className="text-[0.8125rem] text-muted">
              {events.length} רישומים
            </span>
          </div>

          {events.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-[0.9375rem] leading-relaxed text-muted">
              עדיין אין רישומים היום.
              <br />
              הכפתורים למטה מתחילים.
            </p>
          ) : (
            <ol className="relative space-y-1">
              <span
                aria-hidden
                className="absolute top-2 bottom-2 end-[1.375rem] w-px bg-subtle"
              />
              {events.map((e) => (
                <TimelineRow key={e.id} event={e} memberNames={memberNames} />
              ))}
            </ol>
          )}
        </section>
      </main>

      <nav
        aria-label="רישום מהיר"
        className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-lg border-t border-subtle bg-surface-raised/95 px-3 pt-2.5 pb-[calc(0.75rem+var(--safe-bottom))] backdrop-blur"
        style={{ boxShadow: "var(--shadow-sheet)" }}
      >
        <div className="grid grid-cols-5 gap-1.5">
          <QuickButton
            label={breastRunning ? "רץ…" : "הנקה"}
            type="feed_breast"
            icon={IconBreast}
            active={breastRunning}
            onClick={() => (breastRunning ? undefined : setSheet("breast_start"))}
          />
          <QuickButton
            label="בקבוק"
            type="feed_bottle"
            icon={IconBottle}
            onClick={() => setSheet("feed_bottle")}
          />
          <QuickButton
            label="חיתול"
            type="diaper"
            icon={IconDiaper}
            onClick={() => setSheet("diaper")}
          />
          <QuickButton
            label={sleepRunning ? "רץ…" : "שינה"}
            type="sleep"
            icon={IconSleep}
            active={sleepRunning}
            onClick={() =>
              sleepRunning ? undefined : guard(() => startTimer(baby.id, "sleep"))
            }
          />
          <QuickButton
            label="עוד"
            type="note"
            icon={IconPlus}
            onClick={() => setSheet("more")}
          />
        </div>
      </nav>

      {sheet ? (
        <LogSheet
          kind={sheet}
          babyId={baby.id}
          lastAmountMl={
            (lastBottle?.data as { amount_ml?: number } | null)?.amount_ml ?? null
          }
          demo={demo}
          onPick={(type) => setSheet(type)}
          onStartBreast={(side) =>
            guard(async () => {
              await startTimer(baby.id, "feed_breast", side);
              setSheet(null);
            })
          }
          onClose={() => setSheet(null)}
          onDone={refresh}
          onError={setToast}
        />
      ) : null}

      {toast ? <Toast message={toast} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}

function LogSheet({
  kind,
  babyId,
  lastAmountMl,
  demo,
  onPick,
  onStartBreast,
  onClose,
  onDone,
  onError,
}: {
  kind: EventType | "more" | "breast_start";
  babyId: string;
  lastAmountMl: number | null;
  demo: boolean;
  onPick: (type: EventType) => void;
  onStartBreast: (side: "left" | "right") => void;
  onClose: () => void;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  if (kind === "more") {
    return (
      <Sheet title="רישום" onClose={onClose}>
        <div className="grid grid-cols-3 gap-2 pb-2">
          {MORE_ACTIONS.map((type) => {
            const colors = FAMILY_CLASSES[EVENT_META[type].family];
            return (
              <button
                key={type}
                onClick={() => onPick(type)}
                className="flex min-h-tap-hero flex-col items-center justify-center gap-1.5 rounded-lg border border-subtle bg-surface-card transition-transform duration-150 active:scale-95"
              >
                <span
                  className={`grid size-9 place-items-center rounded-full ${colors.soft} ${colors.text}`}
                >
                  <IconFor type={type} className="size-5" />
                </span>
                <span className="text-[0.8125rem] text-default">
                  {EVENT_META[type].label}
                </span>
              </button>
            );
          })}
        </div>
      </Sheet>
    );
  }

  if (kind === "breast_start") {
    return (
      <Sheet title="התחלת הנקה" onClose={onClose}>
        <p className="mb-4 text-center text-[0.9375rem] text-muted">
          מאיזה צד מתחילים? אפשר להחליף באמצע.
        </p>
        <div className="grid grid-cols-2 gap-2.5 pb-2">
          {(["right", "left"] as const).map((side) => (
            <button
              key={side}
              onClick={() => onStartBreast(side)}
              className="min-h-tap-hero rounded-lg border border-feed/40 bg-feed-soft text-[1.0625rem] font-semibold text-strong transition-transform duration-150 active:scale-95"
            >
              {side === "right" ? "ימין" : "שמאל"}
            </button>
          ))}
        </div>
      </Sheet>
    );
  }

  const meta = EVENT_META[kind];
  const props = { babyId, onDone, onError };

  return (
    <Sheet title={`רישום ${meta.label}`} onClose={onClose}>
      {demo ? (
        <p className="mb-3 rounded-md bg-due-soft px-3 py-2 text-[0.8125rem] text-due">
          תצוגה לדוגמה — השמירה מושבתת.
        </p>
      ) : null}
      {kind === "diaper" ? <DiaperForm {...props} /> : null}
      {kind === "feed_bottle" ? (
        <BottleForm {...props} lastAmountMl={lastAmountMl} />
      ) : null}
      {kind === "temperature" ? <TemperatureForm {...props} /> : null}
      {kind === "growth" ? <GrowthForm {...props} /> : null}
      {!["diaper", "feed_bottle", "temperature", "growth"].includes(kind) ? (
        <SimpleForm {...props} type={kind} />
      ) : null}
    </Sheet>
  );
}

function QuickButton({
  label,
  type,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  type: EventType;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  active?: boolean;
  onClick: () => void;
}) {
  const colors = FAMILY_CLASSES[EVENT_META[type].family];
  return (
    <button
      onClick={onClick}
      className="flex min-h-tap-comfy flex-col items-center justify-center gap-1 rounded-md py-2 transition-transform duration-150 active:scale-95"
    >
      <span
        className={[
          "grid size-9 place-items-center rounded-full",
          colors.soft,
          colors.text,
          active ? "ring-2 ring-accent" : "",
        ].join(" ")}
      >
        <Icon className="size-5" />
      </span>
      <span className="text-[0.6875rem] font-medium text-muted">{label}</span>
    </button>
  );
}

function TimelineRow({
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
        className={`order-3 grid size-9 shrink-0 place-items-center rounded-full ${colors.soft} ${colors.text} ring-4 ring-[var(--surface-base)]`}
      >
        <IconFor type={event.type} />
      </span>
    </li>
  );
}

/** הודעה קצרה בתחתית המסך. נעלמת לבד, ואפשר לסגור אותה. */
function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-28 z-50 mx-auto max-w-sm rounded-lg bg-surface-raised px-4 py-3 text-center text-[0.875rem] text-strong"
      style={{ boxShadow: "var(--shadow-lg)" }}
    >
      {message}
    </div>
  );
}
