"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { IconSleep, IconStop } from "@/components/icons";
import { formatDuration } from "@/lib/time";
import { cancelTimer, shiftedStartState, updateTimer, type LogInput } from "@/lib/data/log";
import { TimerStartSheet } from "@/components/timer-start-sheet";
import { BreastTimer } from "@/components/breast-timer";
import { isPending } from "@/lib/use-live-data";
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
  removeTimer,
  patchTimer,
  onError,
}: {
  babyId: string;
  timers: ActiveTimerRow[];
  /** רושם את הסשן שהסתיים — מופיע ברשימה מיד */
  submit: (input: LogInput) => void;
  /** מסיר את הטיימר מהמסך מיד; restore מחזיר אותו אם הרשת נכשלה */
  removeTimer: (id: string) => { restore: () => void };
  patchTimer: (id: string, patch: Partial<ActiveTimerRow>) => { rollback: () => void };
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
          removeTimer={removeTimer}
          patchTimer={patchTimer}
          onError={onError}
        />
      ) : null}
      {sleep ? (
        <SleepTimer
          babyId={babyId}
          timer={sleep}
          submit={submit}
          removeTimer={removeTimer}
          patchTimer={patchTimer}
          onError={onError}
        />
      ) : null}
    </section>
  );
}

function SleepTimer({
  babyId,
  timer,
  submit,
  removeTimer,
  patchTimer,
  onError,
}: {
  babyId: string;
  timer: ActiveTimerRow;
  submit: (input: LogInput) => void;
  removeTimer: (id: string) => { restore: () => void };
  patchTimer: (id: string, patch: Partial<ActiveTimerRow>) => { rollback: () => void };
  onError: (m: string) => void;
}) {
  useSeconds(true);
  const [editingStart, setEditingStart] = useState(false);
  const pending = isPending(timer.id);
  const total = elapsedSeconds(timer.started_at);

  /** תיקון שעת ההירדמות — נרשם לרוב אחרי שהיא כבר נרדמה. */
  function shiftStart(next: Date) {
    if (pending) return;
    const patch = shiftedStartState(timer, next);
    const { rollback } = patchTimer(timer.id, patch);

    updateTimer(timer.id, patch).catch((e: unknown) => {
      rollback();
      onError(e instanceof Error ? e.message : "העדכון נכשל");
    });
  }

  function stop(save: boolean) {
    if (save) {
      submit({
        babyId,
        type: "sleep",
        startedAt: new Date(timer.started_at),
        endedAt: new Date(),
      });
    }

    const { restore } = removeTimer(timer.id);
    cancelTimer(babyId, "sleep").catch((e: unknown) => {
      restore();
      onError(e instanceof Error ? e.message : "לא הצלחנו לעצור את הטיימר");
    });
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
        <button
          onClick={() => setEditingStart(true)}
          aria-label="תיקון שעת ההירדמות"
          className="tnum rounded-md px-1 text-2xl font-semibold text-strong transition-colors duration-150 active:bg-surface-card"
        >
          {formatDuration(total)}
        </button>
      </div>

      <div className="mt-2.5 flex gap-2">
        <Button
          variant="primary"
          fullWidth
          disabled={pending}
          onClick={() => stop(true)}
        >
          <IconStop className="size-4" />
          התעורר/ה
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => stop(false)}
        >
          ביטול
        </Button>
      </div>

      {editingStart ? (
        <TimerStartSheet
          startedAt={timer.started_at}
          onApply={shiftStart}
          onClose={() => setEditingStart(false)}
        />
      ) : null}
    </div>
  );
}

