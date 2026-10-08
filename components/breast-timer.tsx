"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { IconBreast, IconStop } from "@/components/icons";
import { formatClock, formatDuration } from "@/lib/time";
import {
  isPaused as segmentsPaused,
  openSegment,
  parseSegments,
  toEventData,
  totals,
  type NursingSide,
} from "@/lib/nursing";
import { cancelTimer, nextSegmentState, updateTimer, type LogInput } from "@/lib/data/log";
import { isPending } from "@/lib/use-live-data";
import type { ActiveTimerRow } from "@/types/db";

/**
 * טיימר הנקה.
 *
 * שלוש פעולות בלבד, וכולן עושות את אותו דבר מתחת לפני השטח: סוגרות את
 * הקטע הנוכחי ואולי פותחות חדש.
 *
 *   **השהיה** — היא עוצרת לשלוש דקות וממשיכה. הזמן הזה לא נספר כהנקה.
 *   **החלפת צד** — נרשם מתי בדיוק התחילה בצד השני.
 *   **סיום** — נשמרים זמני ההתחלה של כל צד, הסכומים, וזמן ההפסקות.
 *
 * המסך מציג את שעות ההתחלה בפועל ולא רק סכומים, כי "התחילה בימין ב-
 * 10:00 ועברה לשמאל ב-10:14" הוא מידע שהורה באמת רוצה אחר כך.
 */

/** ספירה שנייה-שנייה. כאן, בניגוד לשאר האתר, הספירה עצמה היא המידע. */
function useTick(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
}

export function BreastTimer({
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
  const segments = parseSegments(timer.segments);
  const paused = segmentsPaused(segments);
  const current = openSegment(segments);

  useTick(!paused);

  const pending = isPending(timer.id);
  const sums = totals(segments);

  /** כל שינוי מוחל על המסך מיד, והרשת מתיישרת אחריו. */
  function apply(
    action:
      | { type: "pause" }
      | { type: "resume"; side: NursingSide }
      | { type: "switch"; side: NursingSide },
  ) {
    if (pending) return;
    const patch = nextSegmentState(segments, action);
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
        type: "feed_breast",
        startedAt: new Date(timer.started_at),
        endedAt: new Date(),
        data: toEventData(segments),
      });
    }

    const { restore } = removeTimer(timer.id);
    cancelTimer(babyId, "feed_breast").catch((e: unknown) => {
      restore();
      onError(e instanceof Error ? e.message : "לא הצלחנו לעצור את הטיימר");
    });
  }

  const sideLabel = (side: NursingSide) => (side === "right" ? "ימין" : "שמאל");

  return (
    <div className="rounded-xl border border-feed/25 bg-feed-soft p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-full bg-surface-card text-feed">
            <IconBreast className="size-5" />
          </span>
          <div>
            <p className="text-[0.9375rem] font-semibold text-strong">הנקה</p>
            <p className="text-[0.75rem] text-muted">
              {paused
                ? "מושהה"
                : current
                  ? `${sideLabel(current.side)} · מ-${formatClock(new Date(current.from))}`
                  : "בחרו צד"}
            </p>
          </div>
        </div>

        <span
          className={`tnum text-3xl font-semibold tabular-nums ${paused ? "text-muted" : "text-strong"}`}
        >
          {formatDuration(sums.total)}
        </span>
      </div>

      {/* סכום וזמן התחלה לכל צד — זה מה שחסר קודם */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["right", "left"] as const).map((side) => {
          const active = !paused && current?.side === side;
          const seconds = side === "left" ? sums.left : sums.right;
          const firstStart = segments.find((s) => s.side === side)?.from;

          return (
            <div
              key={side}
              className={[
                "rounded-lg border px-3 py-2",
                active
                  ? "border-feed bg-surface-card"
                  : "border-transparent bg-surface-card/60",
              ].join(" ")}
            >
              <span className="flex items-center gap-1.5 text-[0.75rem] text-muted">
                {sideLabel(side)}
                {active ? (
                  <span
                    aria-label="פעיל"
                    className="size-1.5 animate-pulse rounded-full bg-feed"
                  />
                ) : null}
              </span>
              <span className="tnum block text-[1.0625rem] font-semibold text-strong">
                {formatDuration(seconds)}
              </span>
              {firstStart ? (
                <span className="tnum block text-[0.6875rem] text-faint">
                  החל ב-{formatClock(new Date(firstStart))}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* בחירת צד ראשונה, כשהטיימר נפתח בלי צד */}
      {!current && !paused ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["right", "left"] as const).map((side) => (
            <Button
              key={side}
              variant="secondary"
              disabled={pending}
              onClick={() => apply({ type: "resume", side })}
            >
              {sideLabel(side)}
            </Button>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          {paused ? (
            <Button
              fullWidth
              disabled={pending}
              onClick={() =>
                apply({
                  type: "resume",
                  // ממשיכים מאותו צד — זה המקרה הנפוץ אחרי הפסקה קצרה
                  side: segments[segments.length - 1]?.side ?? "right",
                })
              }
            >
              המשך
            </Button>
          ) : (
            <Button
              variant="secondary"
              fullWidth
              disabled={pending}
              onClick={() => apply({ type: "pause" })}
            >
              השהיה
            </Button>
          )}

          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              apply({
                type: "switch",
                side:
                  (current?.side ?? segments[segments.length - 1]?.side) === "right"
                    ? "left"
                    : "right",
              })
            }
          >
            החלפת צד
          </Button>
        </div>
      )}

      <div className="mt-2 flex gap-2">
        <Button fullWidth disabled={pending || sums.total === 0} onClick={() => stop(true)}>
          <IconStop className="size-4" />
          סיום ושמירה
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => stop(false)}>
          ביטול
        </Button>
      </div>
    </div>
  );
}
