"use client";

import { useState } from "react";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui";
import { logEvent } from "@/lib/data/log";
import type { EventType } from "@/types/db";

/**
 * טפסי הרישום.
 *
 * העיקרון בכל טופס: הוא נפתח כשהוא כבר מוכן לשמירה. שעה = עכשיו,
 * וברירות המחדל הן מה שקורה בדרך כלל. מי שרוצה לדייק — מדייק;
 * מי שמחזיק תינוק ביד אחת — לוחץ פעם אחת ונגמר.
 */

interface FormProps {
  babyId: string;
  onDone: () => void;
  onError: (message: string) => void;
}

/* ---------------------------------------------------------------- כלי עזר */

/** בורר זמן: ברירת המחדל "עכשיו", עם קיצורים לאחור למי שרושם בדיעבד. */
function TimePicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  // השעון המשותף ולא Date.now(): ערך קבוע לאורך הרינדור, ולכן גם
  // "לפני 15 דקות" יחסית בדיוק לאותו רגע שהמשתמש רואה על המסך
  const now = useNow();
  const nowMs = now?.getTime() ?? value.getTime();

  const toLocalInput = (ms: number) =>
    new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  const minutesAgo = Math.round((nowMs - value.getTime()) / 60_000);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[0.875rem] font-medium text-default">מתי</span>
        <span className="text-[0.8125rem] text-muted">
          {minutesAgo <= 1 ? "עכשיו" : `לפני ${minutesAgo} דקות`}
        </span>
      </div>
      <div className="flex gap-1.5">
        {[0, 15, 30, 60].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(new Date(nowMs - m * 60_000))}
            className={[
              "min-h-tap flex-1 rounded-md border text-[0.875rem] transition-colors duration-150",
              Math.abs(minutesAgo - m) <= 1
                ? "border-accent bg-accent-soft text-accent-text"
                : "border-line bg-surface-card text-default",
            ].join(" ")}
          >
            {m === 0 ? "עכשיו" : `לפני ${m}׳`}
          </button>
        ))}
      </div>
      <input
        type="datetime-local"
        value={toLocalInput(value.getTime())}
        max={toLocalInput(nowMs)}
        onChange={(e) => {
          const next = new Date(e.target.value);
          if (!Number.isNaN(next.getTime())) onChange(next);
        }}
        className="min-h-tap rounded-md border border-line bg-surface-sunken px-3 text-[1rem] text-default"
      />
    </div>
  );
}

function NoteField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      placeholder="הערה (לא חובה)"
      className="rounded-md border border-line bg-surface-sunken px-3 py-2.5 text-[1rem] text-strong placeholder:text-faint"
    />
  );
}

/** קבוצת בחירה בלחיצה אחת. */
function ChoiceRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[0.875rem] font-medium text-default">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={[
              "min-h-tap flex-1 rounded-md border px-3 text-[0.9375rem] transition-colors duration-150",
              value === o.value
                ? "border-accent bg-accent-soft font-medium text-accent-text"
                : "border-line bg-surface-card text-default",
            ].join(" ")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function SaveButton({ busy, label = "שמירה" }: { busy: boolean; label?: string }) {
  return (
    <Button type="submit" fullWidth loading={busy} className="mt-1">
      {busy ? "שומר…" : label}
    </Button>
  );
}

/** עוטף שליחה: מונע לחיצה כפולה ומעביר שגיאה למי שמציג אותה. */
function useSubmit(onDone: () => void, onError: (m: string) => void) {
  const [busy, setBusy] = useState(false);

  return {
    busy,
    submit: async (fn: () => Promise<unknown>) => {
      if (busy) return;
      setBusy(true);
      try {
        await fn();
        onDone();
      } catch (e) {
        onError(e instanceof Error ? e.message : "השמירה נכשלה");
        setBusy(false);
      }
    },
  };
}

/* ------------------------------------------------------------------ חיתול */

export function DiaperForm({ babyId, onDone, onError }: FormProps) {
  const [kind, setKind] = useState<"pee" | "poo" | "both" | "dry">("pee");
  const [color, setColor] = useState<string | null>(null);
  const [rash, setRash] = useState(false);
  const [at, setAt] = useState(new Date());
  const [note, setNote] = useState("");
  const { busy, submit } = useSubmit(onDone, onError);

  const hasPoo = kind === "poo" || kind === "both";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() =>
          logEvent({
            babyId,
            type: "diaper",
            startedAt: at,
            note,
            data: {
              pee: kind === "pee" || kind === "both",
              poo: hasPoo,
              color: hasPoo ? color : null,
              rash,
            },
          }),
        );
      }}
    >
      <ChoiceRow
        label="מה היה"
        value={kind}
        onChange={setKind}
        options={[
          { value: "pee", label: "פיפי" },
          { value: "poo", label: "קקי" },
          { value: "both", label: "שניהם" },
          { value: "dry", label: "יבש" },
        ]}
      />

      {hasPoo ? (
        <ChoiceRow
          label="צבע"
          value={color as string | null}
          onChange={setColor}
          options={[
            { value: "yellow", label: "צהוב" },
            { value: "green", label: "ירוק" },
            { value: "brown", label: "חום" },
            { value: "dark", label: "כהה" },
          ]}
        />
      ) : null}

      <label className="flex min-h-tap items-center gap-3 rounded-md border border-line bg-surface-card px-3">
        <input
          type="checkbox"
          checked={rash}
          onChange={(e) => setRash(e.target.checked)}
          className="size-5 accent-[var(--accent)]"
        />
        <span className="text-[0.9375rem] text-default">יש אדמומיות או תפרחת</span>
      </label>

      <TimePicker value={at} onChange={setAt} />
      <NoteField value={note} onChange={setNote} />
      <SaveButton busy={busy} />
    </form>
  );
}

/* ------------------------------------------------------------------ בקבוק */

export function BottleForm({
  babyId,
  onDone,
  onError,
  lastAmountMl,
}: FormProps & { lastAmountMl?: number | null }) {
  const [amount, setAmount] = useState<number>(lastAmountMl ?? 80);
  const [kind, setKind] = useState<"formula" | "breast_milk" | "expressed">("formula");
  const [at, setAt] = useState(new Date());
  const [note, setNote] = useState("");
  const { busy, submit } = useSubmit(onDone, onError);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() =>
          logEvent({
            babyId,
            type: "feed_bottle",
            startedAt: at,
            note,
            data: { amount_ml: amount, kind },
          }),
        );
      }}
    >
      <div className="flex flex-col gap-2">
        <span className="text-[0.875rem] font-medium text-default">כמות</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="פחות 10 מיליליטר"
            onClick={() => setAmount((a) => Math.max(5, a - 10))}
            className="min-h-tap-comfy w-14 rounded-md border border-line bg-surface-card text-xl text-default"
          >
            −
          </button>
          <div className="flex flex-1 items-baseline justify-center gap-1.5">
            <span className="tnum text-3xl font-semibold text-strong">{amount}</span>
            <span className="text-[0.875rem] text-muted">מ״ל</span>
          </div>
          <button
            type="button"
            aria-label="עוד 10 מיליליטר"
            onClick={() => setAmount((a) => Math.min(400, a + 10))}
            className="min-h-tap-comfy w-14 rounded-md border border-line bg-surface-card text-xl text-default"
          >
            +
          </button>
        </div>
        <input
          type="range"
          min={5}
          max={300}
          step={5}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          aria-label="כמות במיליליטר"
          className="accent-[var(--accent)]"
        />
      </div>

      <ChoiceRow
        label="סוג"
        value={kind}
        onChange={setKind}
        options={[
          { value: "formula", label: "תמ״ל" },
          { value: "breast_milk", label: "חלב אם" },
          { value: "expressed", label: "שאוב" },
        ]}
      />

      <TimePicker value={at} onChange={setAt} />
      <NoteField value={note} onChange={setNote} />
      <SaveButton busy={busy} />
    </form>
  );
}

/* -------------------------------------------------------------- חום ומשקל */

export function TemperatureForm({ babyId, onDone, onError }: FormProps) {
  const [celsius, setCelsius] = useState(36.8);
  const [at, setAt] = useState(new Date());
  const [note, setNote] = useState("");
  const { busy, submit } = useSubmit(onDone, onError);

  // ספי ההתייחסות המקובלים לתינוקות
  const status =
    celsius >= 38 ? "חום" : celsius >= 37.5 ? "חום קל" : celsius < 36 ? "נמוך" : "תקין";
  const statusClass =
    celsius >= 38 ? "text-late" : celsius >= 37.5 ? "text-due" : "text-ok";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() =>
          logEvent({
            babyId,
            type: "temperature",
            startedAt: at,
            note,
            data: { celsius },
          }),
        );
      }}
    >
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-baseline gap-1">
          <span className="tnum text-4xl font-semibold text-strong">
            {celsius.toFixed(1)}
          </span>
          <span className="text-lg text-muted">°</span>
        </div>
        <span className={`text-[0.875rem] font-medium ${statusClass}`}>{status}</span>
      </div>

      <input
        type="range"
        min={34}
        max={42}
        step={0.1}
        value={celsius}
        onChange={(e) => setCelsius(Number(e.target.value))}
        aria-label="מעלות צלזיוס"
        className="accent-[var(--accent)]"
      />

      {celsius >= 38 ? (
        <p className="rounded-md bg-late-soft px-3 py-2 text-[0.8125rem] text-late">
          בתינוק מתחת לגיל 3 חודשים, חום של 38 ומעלה מחייב פנייה לרופא.
        </p>
      ) : null}

      <TimePicker value={at} onChange={setAt} />
      <NoteField value={note} onChange={setNote} />
      <SaveButton busy={busy} />
    </form>
  );
}

export function GrowthForm({ babyId, onDone, onError }: FormProps) {
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [headCm, setHeadCm] = useState("");
  const [at, setAt] = useState(new Date());
  const { busy, submit } = useSubmit(onDone, onError);

  const nothing = !weightKg && !heightCm && !headCm;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (nothing) {
          onError("צריך למלא לפחות מדידה אחת");
          return;
        }
        submit(() =>
          logEvent({
            babyId,
            type: "growth",
            startedAt: at,
            data: {
              weight_g: weightKg ? Math.round(parseFloat(weightKg) * 1000) : null,
              height_cm: heightCm ? parseFloat(heightCm) : null,
              head_cm: headCm ? parseFloat(headCm) : null,
            },
          }),
        );
      }}
    >
      {[
        { label: "משקל (ק״ג)", value: weightKg, set: setWeightKg, step: "0.001", ph: "3.150" },
        { label: "אורך (ס״מ)", value: heightCm, set: setHeightCm, step: "0.1", ph: "50.5" },
        { label: "היקף ראש (ס״מ)", value: headCm, set: setHeadCm, step: "0.1", ph: "35.0" },
      ].map((f) => (
        <label key={f.label} className="flex flex-col gap-1.5">
          <span className="text-[0.875rem] font-medium text-default">{f.label}</span>
          <input
            type="number"
            inputMode="decimal"
            step={f.step}
            placeholder={f.ph}
            value={f.value}
            onChange={(e) => f.set(e.target.value)}
            className="min-h-tap-comfy rounded-md border border-line bg-surface-sunken px-3 text-[1rem] text-strong"
          />
        </label>
      ))}

      <TimePicker value={at} onChange={setAt} />
      <SaveButton busy={busy} />
    </form>
  );
}

/* ------------------------------------------------------- הערה ופעילות כללית */

export function SimpleForm({
  babyId,
  type,
  onDone,
  onError,
}: FormProps & { type: EventType }) {
  const [note, setNote] = useState("");
  const [at, setAt] = useState(new Date());
  const { busy, submit } = useSubmit(onDone, onError);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() => logEvent({ babyId, type, startedAt: at, note }));
      }}
    >
      <NoteField value={note} onChange={setNote} />
      <TimePicker value={at} onChange={setAt} />
      <SaveButton busy={busy} />
    </form>
  );
}
