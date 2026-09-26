"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SinceCard } from "@/components/since-card";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui";
import { TimerPanel } from "@/components/timer-panel";
import { PageNav } from "@/components/page-nav";
import { SyncBanner } from "@/components/sync-banner";
import { DueMedications } from "@/components/due-medications";
import { BabySwitcher } from "@/components/baby-switcher";
import { FormForType } from "@/components/log-forms";
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
import { babyAgeHebrew, durationHebrew } from "@/lib/time";
import {
  deleteEvent,
  fetchOlderEvents,
  logEvent,
  startTimer,
  updateEvent,
  type LogInput,
} from "@/lib/data/log";
import { EventList } from "@/components/event-list";
import { makeTempId, useLiveData } from "@/lib/use-live-data";
import { enqueue, isNetworkError } from "@/lib/offline-queue";
import { deletePhotoQuietly } from "@/lib/photos";
import type { MedicationPlan } from "@/lib/medication-plans";
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
  /** מצב הפתיחה מהשרת; מכאן והלאה הרשימה חיה בצד הלקוח */
  events: EventRow[];
  timers: ActiveTimerRow[];
  currentUserId?: string;
  /** שם להצגה לכל user_id, כדי לתייג "מי רשם" */
  memberNames: Record<string, string>;
  /** אזור הזמן של המשפחה — קובע איפה עובר הגבול בין ימים */
  timeZone: string;
  /** מזהה המשפחה — נדרש לנתיב התמונות */
  familyId: string;
  /** כל הילדים במשפחה — המחליף מוצג רק כשיש יותר מאחד */
  siblings?: DashboardBaby[];
  /** סל התרופות והוויטמינים הקבועים */
  medicationPlans?: MedicationPlan[];
  /** האם יש עוד רישומים ישנים מעבר לעמוד הראשון */
  hasMore?: boolean;
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
  events: initialEvents,
  timers: initialTimers,
  memberNames,
  currentUserId,
  timeZone,
  familyId,
  siblings = [],
  medicationPlans = [],
  hasMore = false,
  demo = false,
}: DashboardProps) {
  const {
    events,
    timers,
    addOptimistic,
    removeOptimistic,
    patchEvent,
    appendEvents,
    addTimer,
    patchTimer,
    removeTimer,
  } = useLiveData({
    babyId: baby.id,
    initialEvents,
    initialTimers,
    enabled: !demo,
  });
  const [sheet, setSheet] = useState<EventType | "more" | "breast_start" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ message: string; action: () => void } | null>(
    null,
  );

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

  /**
   * רישום.
   *
   * מופיע על המסך מיד ונשמר ברקע. אם השמירה נכשלה הוא מוסר והודעה
   * מסבירה — אבל במקרה הרגיל אין שום המתנה לרשת.
   */
  const submit = useCallback(
    (input: LogInput) => {
      if (demo) {
        setToast("זו תצוגה לדוגמה — הרישום יעבוד אחרי ההתחברות");
        return;
      }

      const optimistic: EventRow = {
        id: makeTempId(),
        baby_id: input.babyId,
        family_id: "",
        type: input.type,
        started_at: input.startedAt.toISOString(),
        ended_at: input.endedAt ? input.endedAt.toISOString() : null,
        data: (input.data ?? {}) as EventRow["data"],
        note: input.note?.trim() || null,
        photo_path: null,
        created_by: currentUserId ?? "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: null,
        deleted_at: null,
      };

      const { confirm, rollback } = addOptimistic(optimistic);

      logEvent(input, currentUserId ?? "")
        .then(({ id }) => confirm({ ...optimistic, id }))
        .catch((e: unknown) => {
          if (isNetworkError(e)) {
            // אין רשת: הרישום נשאר על המסך ונשמר לשליחה מאוחרת.
            // הסרתו כאן הייתה אומרת להורה שהרישום אבד, והוא לא אבד.
            enqueue(optimistic.id, input).catch(() => {
              rollback();
              setToast("לא הצלחנו לשמור את הרישום");
            });
            return;
          }

          rollback();
          setToast(e instanceof Error ? e.message : "השמירה נכשלה");
        });
    },
    [addOptimistic, currentUserId, demo],
  );

  /** מוסיף לרשימה עמוד של רישומים ישנים יותר. */
  const appendOlder = useCallback(
    (older: EventRow[]) => appendEvents(older),
    [appendEvents],
  );

  /** עריכת רישום קיים — משתקפת על המסך מיד. */
  const handleEdit = useCallback(
    (event: EventRow, input: LogInput) => {
      if (demo) {
        setToast("זו תצוגה לדוגמה — העריכה תעבוד אחרי ההתחברות");
        return;
      }

      const { rollback } = patchEvent(event.id, {
        started_at: input.startedAt.toISOString(),
        ended_at: input.endedAt ? input.endedAt.toISOString() : null,
        data: (input.data ?? {}) as EventRow["data"],
        note: input.note?.trim() || null,
      });

      updateEvent(
        event.id,
        {
          startedAt: input.startedAt,
          endedAt: input.endedAt ?? null,
          data: input.data ?? {},
          note: input.note ?? null,
        },
        currentUserId ?? "",
      ).catch((e: unknown) => {
        rollback();
        setToast(e instanceof Error ? e.message : "העריכה נכשלה");
      });
    },
    [currentUserId, demo, patchEvent],
  );

  /** מחיקה רכה, עם אפשרות להחזיר. */
  const handleDelete = useCallback(
    (event: EventRow) => {
      if (demo) {
        setToast("זו תצוגה לדוגמה — המחיקה תעבוד אחרי ההתחברות");
        return;
      }

      const { restore } = removeOptimistic(event.id);

      deleteEvent(event.id)
        .then(() => {
          // התמונה נמחקת עם הרישום — אין טעם להשאיר קובץ שאף אחד לא
          // יגיע אליו, ולא נכון להחזיק תמונה של תינוק אחרי מחיקה.
          // "ביטול" משחזר את הרישום בלי התמונה.
          if (event.photo_path) deletePhotoQuietly(event.photo_path);

          setUndo({
            message: `${EVENT_META[event.type].label} נמחק`,
            // "ביטול" רושם מחדש את אותם נתונים — הרישום המקורי נשאר מחוק
            action: () =>
              submit({
                babyId: event.baby_id,
                type: event.type,
                startedAt: new Date(event.started_at),
                endedAt: event.ended_at ? new Date(event.ended_at) : null,
                data: (event.data ?? {}) as Record<string, unknown>,
                note: event.note,
              }),
          });
        })
        .catch((e: unknown) => {
          restore();
          setToast(e instanceof Error ? e.message : "המחיקה נכשלה");
        });
    },
    [demo, removeOptimistic, submit],
  );

  /** הטיימר מופיע על המסך מיד; ההרשמה בשרת ממשיכה ברקע. */
  function startTimerNow(type: "feed_breast" | "sleep", side?: "left" | "right") {
    setSheet(null);
    if (demo) {
      setToast("זו תצוגה לדוגמה — הטיימר יעבוד אחרי ההתחברות");
      return;
    }

    const now = new Date().toISOString();
    const { confirm, rollback } = addTimer({
      id: makeTempId(),
      baby_id: baby.id,
      family_id: "",
      type,
      side: side ?? null,
      left_sec: 0,
      right_sec: 0,
      started_at: now,
      segment_started_at: now,
      paused_at: null,
      started_by: currentUserId ?? "",
    });

    startTimer(baby.id, type, currentUserId ?? "", side)
      .then(confirm)
      .catch((e: unknown) => {
        rollback();
        setToast(e instanceof Error ? e.message : "לא הצלחנו להתחיל את הטיימר");
      });
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

        <BabySwitcher babies={siblings} selectedId={baby.id} />
      </header>

      <PageNav />
      {demo ? null : <SyncBanner userId={currentUserId ?? ""} />}

      <main id="main" className="flex-1 px-4 pb-32">
        <DueMedications
          plans={medicationPlans}
          events={events}
          timeZone={timeZone}
          babyId={baby.id}
          submit={submit}
        />

        <TimerPanel
          babyId={baby.id}
          timers={timers}
          submit={submit}
          removeTimer={removeTimer}
          patchTimer={patchTimer}
          onError={setToast}
        />

        <section aria-label="מצב נוכחי" className="grid grid-cols-3 gap-2.5">
          <SinceCard
            title="האכלה"
            family="feed"
            icon={IconBottle}
            lastAt={breastRunning ? null : (lastFeed?.started_at ?? null)}
            overrideText={breastRunning ? "אוכל/ת" : undefined}
            detail={lastFeed ? summarizeEvent(lastFeed.type, lastFeed.data) : null}
            dueAfterHours={2.5}
            lateAfterHours={4}
          />
          <SinceCard
            title="שינה"
            family="sleep"
            icon={IconSleep}
            // הכרטיס מודד כמה זמן היא *ערה*, ולכן נמדד מרגע היקיצה
            // ולא מרגע ההירדמות. קודם נמדד מ-started_at, ולכן שינה של
            // שעתיים שהסתיימה לפני רבע שעה הוצגה כ"לפני שעתיים ורבע".
            lastAt={sleepRunning ? null : (lastSleep?.ended_at ?? lastSleep?.started_at ?? null)}
            overrideText={sleepRunning ? "ישן/ה" : undefined}
            detail={
              lastSleep?.ended_at
                ? `ישנה ${durationHebrew(
                    (new Date(lastSleep.ended_at).getTime() -
                      new Date(lastSleep.started_at).getTime()) /
                      1000,
                  )}`
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

        <section aria-label="רישומים" className="mt-7">
          <h2 className="mb-2.5 text-[0.9375rem] font-semibold text-strong">
            הרישומים
          </h2>

          {events.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-[0.9375rem] leading-relaxed text-muted">
              עדיין אין רישומים.
              <br />
              הכפתורים למטה מתחילים.
            </p>
          ) : (
            <>
              <EventList
                events={events}
                memberNames={memberNames}
                timeZone={timeZone}
                familyId={familyId}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
              <LoadMore
                babyId={baby.id}
                oldest={events[events.length - 1]?.started_at}
                hasMore={hasMore}
                onLoaded={appendOlder}
                onError={setToast}
              />
            </>
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
            onClick={() => (sleepRunning ? undefined : startTimerNow("sleep"))}
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
          recentEvents={events}
          medicationPlans={medicationPlans}
          familyId={familyId}
          demo={demo}
          submit={submit}
          onPick={(type) => setSheet(type)}
          onStartBreast={(side) => startTimerNow("feed_breast", side)}
          onClose={() => setSheet(null)}
          onDone={() => setSheet(null)}
          onError={setToast}
        />
      ) : null}

      {toast ? <Toast message={toast} onDismiss={() => setToast(null)} /> : null}
      {undo ? (
        <Toast
          message={undo.message}
          actionLabel="ביטול"
          onAction={() => {
            undo.action();
            setUndo(null);
          }}
          onDismiss={() => setUndo(null)}
        />
      ) : null}
    </div>
  );
}

function LogSheet({
  kind,
  babyId,
  familyId,
  lastAmountMl,
  recentEvents,
  medicationPlans,
  demo,
  submit,
  onPick,
  onStartBreast,
  onClose,
  onDone,
  onError,
}: {
  kind: EventType | "more" | "breast_start";
  babyId: string;
  lastAmountMl: number | null;
  familyId: string;
  /** לבדיקת מרווח בין מנות תרופה */
  recentEvents: EventRow[];
  medicationPlans: MedicationPlan[];
  demo: boolean;
  submit: (input: LogInput) => void;
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
  const props = {
    babyId,
    familyId,
    submit,
    onDone,
    onError,
    recentEvents,
    medicationPlans,
  };

  return (
    <Sheet title={`רישום ${meta.label}`} onClose={onClose}>
      {demo ? (
        <p className="mb-3 rounded-md bg-due-soft px-3 py-2 text-[0.8125rem] text-due">
          תצוגה לדוגמה — השמירה מושבתת.
        </p>
      ) : null}
      <FormForType {...props} type={kind} lastAmountMl={lastAmountMl} />
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

/**
 * טעינת רישומים ישנים יותר.
 *
 * נטענים כשמגיעים לתחתית, ולא הכל מראש: אחרי חצי שנה של רישומים אלה
 * אלפי שורות, ואין סיבה להוריד אותן כדי לראות את אתמול. יש גם כפתור
 * מפורש — גלילה אוטומטית לבדה אינה נגישה למקלדת.
 */
function LoadMore({
  babyId,
  oldest,
  hasMore,
  onLoaded,
  onError,
}: {
  babyId: string;
  /** הרישום הישן ביותר שכבר מוצג — נקודת ההתחלה לעמוד הבא */
  oldest?: string;
  hasMore: boolean;
  onLoaded: (events: EventRow[]) => void;
  onError: (message: string) => void;
}) {
  const [exhausted, setExhausted] = useState(!hasMore);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current || exhausted || !oldest) return;
    busy.current = true;
    setLoading(true);

    try {
      const older = await fetchOlderEvents(babyId, oldest);
      if (older.length === 0) setExhausted(true);
      else onLoaded(older);
    } catch (e) {
      onError(e instanceof Error ? e.message : "טעינת הרישומים נכשלה");
      setExhausted(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [babyId, exhausted, oldest, onError, onLoaded]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || exhausted) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) load();
      },
      // מתחילים לטעון קצת לפני הסוף, כדי שהגלילה לא תיעצר
      { rootMargin: "400px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [exhausted, load]);

  if (exhausted) {
    return (
      <p className="py-6 text-center text-[0.75rem] text-faint">
        זו ההתחלה של היומן
      </p>
    );
  }

  return (
    <div ref={sentinel} className="py-4">
      <Button variant="secondary" fullWidth loading={loading} onClick={load}>
        {loading ? "טוען…" : "רישומים ישנים יותר"}
      </Button>
    </div>
  );
}

/** הודעה קצרה בתחתית המסך. נעלמת לבד, ואפשר לסגור או לפעול ממנה. */
function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}) {
  // ref ולא תלות ישירה: כך שינוי ב-onDismiss לא מאפס את הטיימר בכל רינדור
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const id = setTimeout(() => dismiss.current(), actionLabel ? 6000 : 4000);
    return () => clearTimeout(id);
  }, [actionLabel]);

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-28 z-50 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-lg bg-surface-raised px-4 py-3 text-[0.875rem] text-strong"
      style={{ boxShadow: "var(--shadow-lg)" }}
    >
      <span className="flex-1 text-start">{message}</span>
      {actionLabel ? (
        <button
          onClick={onAction}
          className="shrink-0 font-semibold text-accent-text"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
