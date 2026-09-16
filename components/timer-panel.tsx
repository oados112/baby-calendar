"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { IconBreast, IconSleep, IconStop } from "@/components/icons";
import { formatDuration } from "@/lib/time";
import { cancelTimer, switchSide, type LogInput } from "@/lib/data/log";
import type { ActiveTimerRow } from "@/types/db";

/**
 * טיימר משותף להנקה ולשינה.
 *
 * הטיימר נשמר בשרת, לא בדפדפן. המשמעות המעשית: אפשר לנעול את המסך,
 * לסגור את הדפדפן, או להמשיך מהטלפון השני — הוא ימשיך לרוץ ויציג
 * את אותו זמן בדיוק בשני המכשירים.
 */

/** שנייה-שנייה, בניגוד לשאר האתר: כאן הספירה עצמה היא המידע. */
function useSeconds(active: boolean) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return tick;
}

function elapsedSeconds(from: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 1000));
}

export function TimerPanel({
  babyId,
  timers,
  submit,
  onError,
}: {
  babyId: string;
  timers: ActiveTimerRow[];
  /** רושם את הסשן שהסתיים — מופיע ברשימה מיד */
  submit: (input: LogInput) => void;
  onError: (message: string) => void;
}) {
  const breast = timers.find((t) => t.type === "feed_breast") ?? null;
  const sleep = timers.find((t) => t.type === "sleep") ?? null;

  if (!breast && !sleep) return null;

  return (
    <section aria-label="טיימרים פעילים" className="mb-4 flex flex-col gap-2.5">
      {breast ? (
        <BreastTimer
          babyId={babyId}
          timer={breast}
          submit={submit}
          onError={onError}
        />
      ) : null}
      {sleep ? (
        <SleepTimer babyId={babyId} timer={sleep} submit={submit} onError={onError} />
      ) : null}
    </section>
  );
}

function BreastTimer({
  babyId,
  timer,
  submit,
  onError,
}: {
  babyId: string;
  timer: ActiveTimerRow;
  submit: (input: LogInput) => void;
  onError: (m: string) => void;
}) {
  useSeconds(true);
  const [busy, setBusy] = useState(false);

  const segment = elapsedSeconds(timer.segment_started_at);
  const left = timer.left_sec + (timer.side === "left" ? segment : 0);
  const right = timer.right_sec + (timer.side === "right" ? segment : 0);
  const total = left + right;

  async function act(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      onError(e instanceof Error ? e.message : "הפעולה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-feed/30 bg-feed-soft p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-surface-card text-feed">
            <IconBreast className="size-4.5" />
          </span>
          <span className="text-[0.875rem] font-medium text-strong">הנקה</span>
        </div>
        <span className="tnum text-2xl font-semibold text-strong" aria-live="off">
          {formatDuration(total)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["right", "left"] as const).map((side) => {
          const active = timer.side === side;
          const seconds = side === "left" ? left : right;
          return (
            <button
              key={side}
              type="button"
              disabled={busy}
              onClick={() =>
                active
                  ? undefined
                  : act(() =>
                      switchSide(timer.id, {
                        side: timer.side,
                        leftSec: timer.left_sec,
                        rightSec: timer.right_sec,
                        segmentStartedAt: timer.segment_started_at,
                      }),
                    )
              }
              aria-pressed={active}
              className={[
                "min-h-tap-comfy rounded-md border px-3 text-start transition-colors duration-150",
                active
                  ? "border-feed bg-surface-card"
                  : "border-transparent bg-surface-card/60",
              ].join(" ")}
            >
              <span className="block text-[0.8125rem] text-muted">
                {side === "left" ? "שמאל" : "ימין"}
                {active ? " · פעיל" : ""}
              </span>
              <span className="tnum block text-[1.0625rem] font-medium text-strong">
                {formatDuration(seconds)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex gap-2">
        <Button
          variant="primary"
          fullWidth
          disabled={busy}
          onClick={() => {
            // הרישום נשלח קודם ומופיע מיד; עצירת הטיימר ממשיכה ברקע
            submit({
              babyId,
              type: "feed_breast",
              startedAt: new Date(timer.started_at),
              endedAt: new Date(),
              data: { left_sec: left, right_sec: right, last_side: timer.side },
            });
            act(() => cancelTimer(babyId, "feed_breast"));
          }}
        >
          <IconStop className="size-4" />
          סיום ושמירה
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => act(() => cancelTimer(babyId, "feed_breast"))}
        >
          ביטול
        </Button>
      </div>
    </div>
  );
}

function SleepTimer({
  babyId,
  timer,
  submit,
  onError,
}: {
  babyId: string;
  timer: ActiveTimerRow;
  submit: (input: LogInput) => void;
  onError: (m: string) => void;
}) {
  useSeconds(true);
  const [busy, setBusy] = useState(false);
  const total = elapsedSeconds(timer.started_at);

  async function act(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      onError(e instanceof Error ? e.message : "הפעולה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-sleep/30 bg-sleep-soft p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-surface-card text-sleep">
            <IconSleep className="size-4.5" />
          </span>
          <span className="text-[0.875rem] font-medium text-strong">ישן/ה עכשיו</span>
        </div>
        <span className="tnum text-2xl font-semibold text-strong">
          {formatDuration(total)}
        </span>
      </div>

      <div className="mt-2.5 flex gap-2">
        <Button
          variant="primary"
          fullWidth
          disabled={busy}
          onClick={() => {
            submit({
              babyId,
              type: "sleep",
              startedAt: new Date(timer.started_at),
              endedAt: new Date(),
            });
            act(() => cancelTimer(babyId, "sleep"));
          }}
        >
          <IconStop className="size-4" />
          התעורר/ה
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => act(() => cancelTimer(babyId, "sleep"))}
        >
          ביטול
        </Button>
      </div>
    </div>
  );
}

