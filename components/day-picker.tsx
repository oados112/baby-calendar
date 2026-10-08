"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/sheet";
import {
  longDate,
  monthDays,
  monthLabel,
  monthOf,
  shiftDayKey,
  shiftMonthKey,
} from "@/lib/zoned";

/**
 * בחירת יום ביומן.
 *
 * כותרת התאריך היא כפתור שפותח לוח שנה. קודם היו רק חצים, וכדי להגיע
 * לשבוע שעבר היה צריך שבע לחיצות; עכשיו זו לחיצה אחת ובחירה.
 *
 * ימים עתידיים ותאריכים שלפני הלידה כבויים — אין מה להראות שם, ועדיף
 * לכבות אותם מאשר לפתוח יום ריק.
 */

const WEEKDAY_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export function DayPicker({
  dayKey,
  todayKey,
  minKey,
}: {
  dayKey: string;
  todayKey: string;
  /** היום הראשון שיש בו משמעות — תאריך הלידה */
  minKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const isToday = dayKey === todayKey;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="mx-auto flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[1.0625rem] font-semibold text-strong transition-colors duration-150 active:bg-surface-sunken"
      >
        {isToday ? "היום" : longDate(dayKey)}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="size-3.5 text-muted"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <CalendarSheet
          dayKey={dayKey}
          todayKey={todayKey}
          minKey={minKey}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function CalendarSheet({
  dayKey,
  todayKey,
  minKey,
  onClose,
}: {
  dayKey: string;
  todayKey: string;
  minKey?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  // החודש המוצג נע בנפרד מהיום הנבחר — אפשר לדפדף בלי לבחור
  const [cursor, setCursor] = useState(dayKey);

  function pick(key: string) {
    onClose();
    router.push(key === todayKey ? "/journal" : `/journal?date=${key}`);
  }

  const cells = monthDays(cursor);
  const canGoBack = !minKey || monthOf(cursor) > monthOf(minKey);
  const canGoForward = monthOf(cursor) < monthOf(todayKey);

  const shortcuts: { label: string; key: string }[] = [
    { label: "היום", key: todayKey },
    { label: "אתמול", key: shiftDayKey(todayKey, -1) },
    { label: "לפני שבוע", key: shiftDayKey(todayKey, -7) },
  ];

  return (
    <Sheet title="בחירת תאריך" onClose={onClose}>
      {/* דפדוף חודשים. RTL: החץ הימני מוביל אחורה בזמן. */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <MonthArrow
          direction="back"
          disabled={!canGoBack}
          onClick={() => setCursor(shiftMonthKey(cursor, -1))}
        />
        <span
          aria-live="polite"
          className="text-[0.9375rem] font-semibold text-strong"
        >
          {monthLabel(cursor)}
        </span>
        <MonthArrow
          direction="forward"
          disabled={!canGoForward}
          onClick={() => setCursor(shiftMonthKey(cursor, 1))}
        />
      </div>

      <div
        className="mb-1 grid grid-cols-7 gap-1 text-center text-[0.6875rem] text-faint"
        aria-hidden
      >
        {WEEKDAY_LETTERS.map((letter) => (
          <span key={letter}>{letter}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((key, i) =>
          key === null ? (
            <span key={`pad-${i}`} />
          ) : (
            <DayCell
              key={key}
              dayKey={key}
              selected={key === dayKey}
              isToday={key === todayKey}
              disabled={key > todayKey || (minKey ? key < minKey : false)}
              onPick={pick}
            />
          ),
        )}
      </div>

      <div className="mt-4 flex gap-2">
        {shortcuts.map((s) => (
          <button
            key={s.label}
            disabled={minKey ? s.key < minKey : false}
            onClick={() => pick(s.key)}
            className="min-h-tap flex-1 rounded-full border border-subtle bg-surface-card text-[0.8125rem] text-default transition-transform duration-150 active:scale-95 disabled:opacity-40"
          >
            {s.label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function DayCell({
  dayKey,
  selected,
  isToday,
  disabled,
  onPick,
}: {
  dayKey: string;
  selected: boolean;
  isToday: boolean;
  disabled: boolean;
  onPick: (key: string) => void;
}) {
  const day = Number(dayKey.slice(8));

  return (
    <button
      disabled={disabled}
      onClick={() => onPick(dayKey)}
      aria-current={selected ? "date" : undefined}
      aria-label={longDate(dayKey)}
      className={[
        "tnum relative grid aspect-square place-items-center rounded-full text-[0.875rem]",
        "transition-colors duration-150",
        disabled
          ? "text-faint/50"
          : selected
            ? "bg-accent font-semibold text-on-accent"
            : isToday
              ? "bg-accent-soft font-semibold text-accent-text"
              : "text-default active:bg-surface-sunken",
      ].join(" ")}
    >
      {day}
    </button>
  );
}

function MonthArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "back" | "forward";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      aria-label={direction === "back" ? "החודש הקודם" : "החודש הבא"}
      className="grid size-10 shrink-0 place-items-center rounded-full border border-subtle bg-surface-card text-default transition-transform duration-150 active:scale-90 disabled:opacity-30"
    >
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
    </button>
  );
}
