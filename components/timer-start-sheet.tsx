"use client";

import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui";
import { formatClock } from "@/lib/time";
import { useNow } from "@/lib/use-now";

/**
 * תיקון שעת ההתחלה של טיימר שרץ.
 *
 * מתחילים להניק, ורק אחרי רבע שעה נזכרים ללחוץ. עד עכשיו הדרך היחידה
 * לתקן הייתה לסיים את הסשן ולערוך את הרישום — כלומר לעצור דבר שעדיין
 * קורה. כאן מזיזים את ההתחלה אחורה בלי לגעת בטיימר עצמו.
 *
 * קדימה אי אפשר להזיז מעבר לעכשיו, ואחורה לא יותר משתים-עשרה שעות:
 * טיימר שרץ יותר מזה הוא כמעט תמיד כזה ששכחו לעצור, לא כזה ששכחו
 * להתחיל.
 */

const MAX_HOURS_BACK = 12;
const QUICK_MINUTES = [5, 10, 15, 20, 30, 45];

export function TimerStartSheet({
  startedAt,
  onApply,
  onClose,
}: {
  startedAt: string;
  onApply: (next: Date) => void;
  onClose: () => void;
}) {
  const now = useNow();
  const [value, setValue] = useState(() => new Date(startedAt));
  // השעון המשותף ולא Date.now(): ערך קבוע לאורך הרינדור, כך ש"לפני
  // 15 דקות" נמדד מאותו רגע שהמשתמש רואה על המסך
  const nowMs = now?.getTime() ?? new Date(startedAt).getTime();

  const elapsedMinutes = Math.round((nowMs - value.getTime()) / 60_000);
  const earliest = nowMs - MAX_HOURS_BACK * 3600_000;
  const valid = value.getTime() <= nowMs && value.getTime() >= earliest;

  const toLocalInput = (ms: number) =>
    new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  return (
    <Sheet title="מתי זה התחיל?" onClose={onClose}>
      <p className="mb-4 text-center text-[0.875rem] text-muted">
        הטיימר ימשיך לרוץ — רק נקודת ההתחלה זזה.
      </p>

      <div className="mb-4 rounded-lg bg-surface-sunken px-4 py-3 text-center">
        <span className="tnum block text-2xl font-semibold text-strong">
          {formatClock(value)}
        </span>
        <span className="text-[0.8125rem] text-muted">
          {elapsedMinutes <= 1 ? "עכשיו" : `לפני ${elapsedMinutes} דקות`}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {QUICK_MINUTES.map((m) => {
          const selected = Math.abs(elapsedMinutes - m) <= 1;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setValue(new Date(nowMs - m * 60_000))}
              className={[
                "min-h-tap rounded-md border text-[0.875rem] transition-colors duration-150",
                selected
                  ? "border-accent bg-accent-soft font-medium text-accent-text"
                  : "border-line bg-surface-card text-default",
              ].join(" ")}
            >
              לפני {m}׳
            </button>
          );
        })}
      </div>

      <label className="mt-3 flex flex-col gap-1.5">
        <span className="text-[0.8125rem] text-muted">או שעה מדויקת</span>
        <input
          type="datetime-local"
          value={toLocalInput(value.getTime())}
          max={toLocalInput(nowMs)}
          min={toLocalInput(earliest)}
          onChange={(e) => {
            const next = new Date(e.target.value);
            if (!Number.isNaN(next.getTime())) setValue(next);
          }}
          className="min-h-tap rounded-md border border-line bg-surface-sunken px-3 text-[1rem] text-default"
        />
      </label>

      <Button
        fullWidth
        className="mt-5"
        disabled={!valid}
        onClick={() => {
          onApply(value);
          onClose();
        }}
      >
        עדכון
      </Button>
    </Sheet>
  );
}
