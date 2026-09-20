"use client";

import { useState } from "react";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui";
import { checkDose, findMedicine, MEDICINES } from "@/lib/medicines";
import { durationHebrew } from "@/lib/time";
import type { LogInput } from "@/lib/data/log";
import type { EventRow, EventType } from "@/types/db";

/**
 * טפסי הרישום.
 *
 * שני עקרונות:
 *
 *  1. הטופס נפתח כשהוא כבר מוכן לשמירה. השעה היא "עכשיו", וברירות
 *     המחדל הן מה שקורה בדרך כלל. מי שרוצה לדייק — מדייק; מי שמחזיק
 *     תינוק ביד אחת — לוחץ פעם אחת ונגמר.
 *
 *  2. אותו טופס משמש גם לעריכה. כשמועבר `initial`, השדות נטענים מתוך
 *     הרישום הקיים — כך שלחיצה בטעות אינה גוזרת רישום שגוי לנצח,
 *     ואפשר לתקן כמות, סוג או שעה אחר כך.
 */

export interface FormProps {
  babyId: string;
  /**
   * שולח את הרישום. לא מחזיר Promise בכוונה: המסך נסגר והרישום מופיע
   * מיד, והשמירה בפועל ממשיכה ברקע.
   */
  submit: (input: LogInput) => void;
  /** רישום קיים לעריכה. null/undefined = רישום חדש */
  initial?: EventRow | null;
  onDone: () => void;
  /** שגיאת קלט מקומית (לא שגיאת רשת — זו מטופלת ברקע) */
  onError: (message: string) => void;
  /** רישומים אחרונים — משמשים לבדיקת מרווח בין מנות תרופה */
  recentEvents?: { type: string; started_at: string; data: unknown }[];
}

/* ---------------------------------------------------------------- כלי עזר */

function initialData(initial?: EventRow | null): Record<string, unknown> {
  return (initial?.data ?? {}) as Record<string, unknown>;
}

function num(data: Record<string, unknown>, key: string): number | null {
  return typeof data[key] === "number" ? (data[key] as number) : null;
}

function str(data: Record<string, unknown>, key: string): string | null {
  return typeof data[key] === "string" ? (data[key] as string) : null;
}

function startOf(initial?: EventRow | null): Date {
  return initial ? new Date(initial.started_at) : new Date();
}

function minutesToSec(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : 0;
}

function secToMinutes(seconds: number | null): string {
  return seconds && seconds > 0 ? String(Math.round(seconds / 60)) : "";
}

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

/** שדה מספרי עם תווית ויחידה. */
function NumberField({
  label,
  unit,
  value,
  onChange,
  step = "1",
  placeholder,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="text-[0.8125rem] text-muted">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min="0"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-tap-comfy w-full rounded-md border border-line bg-surface-sunken px-3 text-[1rem] text-strong"
        />
        {unit ? (
          <span className="shrink-0 text-[0.8125rem] text-muted">{unit}</span>
        ) : null}
      </div>
    </label>
  );
}

function SaveButton({ editing }: { editing: boolean }) {
  return (
    <Button type="submit" fullWidth className="mt-1">
      {editing ? "שמירת השינויים" : "שמירה"}
    </Button>
  );
}

/* ------------------------------------------------------------------ חיתול */

export function DiaperForm({ babyId, submit, initial, onDone }: FormProps) {
  const d = initialData(initial);
  const initialKind: "pee" | "poo" | "both" | "dry" =
    d.pee && d.poo ? "both" : d.poo ? "poo" : d.pee ? "pee" : initial ? "dry" : "pee";

  const [kind, setKind] = useState(initialKind);
  const [color, setColor] = useState<string | null>(str(d, "color"));
  const [rash, setRash] = useState(Boolean(d.rash));
  const [at, setAt] = useState(startOf(initial));
  const [note, setNote] = useState(initial?.note ?? "");

  const hasPoo = kind === "poo" || kind === "both";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit({
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
        });
        onDone();
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
          value={color}
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
      <SaveButton editing={Boolean(initial)} />
    </form>
  );
}

/* ------------------------------------------------------------------ בקבוק */

export function BottleForm({
  babyId,
  submit,
  initial,
  onDone,
  lastAmountMl,
}: FormProps & { lastAmountMl?: number | null }) {
  const d = initialData(initial);
  const [amount, setAmount] = useState<number>(
    num(d, "amount_ml") ?? lastAmountMl ?? 80,
  );
  const [kind, setKind] = useState<"formula" | "breast_milk" | "expressed">(
    (str(d, "kind") as "formula" | "breast_milk" | "expressed" | null) ?? "formula",
  );
  const [at, setAt] = useState(startOf(initial));
  const [note, setNote] = useState(initial?.note ?? "");

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit({
          babyId,
          type: "feed_bottle",
          startedAt: at,
          note,
          data: { amount_ml: amount, kind },
        });
        onDone();
      }}
    >
      <div className="flex flex-col gap-2">
        <span className="text-[0.875rem] font-medium text-default">כמות</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="פחות 5 מיליליטר"
            onClick={() => setAmount((a) => Math.max(5, a - 5))}
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
            aria-label="עוד 5 מיליליטר"
            onClick={() => setAmount((a) => Math.min(400, a + 5))}
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
      <SaveButton editing={Boolean(initial)} />
    </form>
  );
}

/* ----------------------------------------------------------------- שאיבה */

/**
 * שאיבה — כמות ומשך לכל שד בנפרד.
 *
 * ההפרדה חשובה בפועל: פער עקבי בין הצדדים הוא מידע אמיתי (סתימת צינורית,
 * ירידה בייצור בצד אחד), והסכום לבדו מסתיר אותו.
 */
export function PumpForm({ babyId, submit, initial, onDone }: FormProps) {
  const d = initialData(initial);
  const [leftMl, setLeftMl] = useState(num(d, "left_ml")?.toString() ?? "");
  const [rightMl, setRightMl] = useState(num(d, "right_ml")?.toString() ?? "");
  const [leftMin, setLeftMin] = useState(secToMinutes(num(d, "left_sec")));
  const [rightMin, setRightMin] = useState(secToMinutes(num(d, "right_sec")));
  const [at, setAt] = useState(startOf(initial));
  const [note, setNote] = useState(initial?.note ?? "");

  const total = (parseFloat(leftMl) || 0) + (parseFloat(rightMl) || 0);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const leftSec = minutesToSec(leftMin);
        const rightSec = minutesToSec(rightMin);

        submit({
          babyId,
          type: "pump",
          startedAt: at,
          endedAt:
            leftSec + rightSec > 0
              ? new Date(at.getTime() + (leftSec + rightSec) * 1000)
              : null,
          note,
          data: {
            left_ml: parseFloat(leftMl) || 0,
            right_ml: parseFloat(rightMl) || 0,
            amount_ml: total,
            left_sec: leftSec,
            right_sec: rightSec,
          },
        });
        onDone();
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[0.875rem] font-medium text-default">
          כמה נשאב
        </legend>
        <div className="flex gap-3">
          <NumberField
            label="ימין"
            unit="מ״ל"
            value={rightMl}
            onChange={setRightMl}
            step="5"
            placeholder="0"
          />
          <NumberField
            label="שמאל"
            unit="מ״ל"
            value={leftMl}
            onChange={setLeftMl}
            step="5"
            placeholder="0"
          />
        </div>
        <p className="text-center text-[0.8125rem] text-muted">
          סה״כ <span className="tnum font-medium text-strong">{total || 0}</span> מ״ל
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[0.875rem] font-medium text-default">
          כמה זמן (לא חובה)
        </legend>
        <div className="flex gap-3">
          <NumberField
            label="ימין"
            unit="דק׳"
            value={rightMin}
            onChange={setRightMin}
            placeholder="0"
          />
          <NumberField
            label="שמאל"
            unit="דק׳"
            value={leftMin}
            onChange={setLeftMin}
            placeholder="0"
          />
        </div>
      </fieldset>

      <TimePicker value={at} onChange={setAt} />
      <NoteField value={note} onChange={setNote} />
      <SaveButton editing={Boolean(initial)} />
    </form>
  );
}

/* ------------------------------------------------------------------ הנקה */

/** הנקה שנרשמת ידנית או נערכת אחרי טיימר — זמן לכל צד. */
export function BreastForm({ babyId, submit, initial, onDone }: FormProps) {
  const d = initialData(initial);
  const [leftMin, setLeftMin] = useState(secToMinutes(num(d, "left_sec")));
  const [rightMin, setRightMin] = useState(secToMinutes(num(d, "right_sec")));
  const [at, setAt] = useState(startOf(initial));
  const [note, setNote] = useState(initial?.note ?? "");

  const totalMin = (parseFloat(leftMin) || 0) + (parseFloat(rightMin) || 0);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const leftSec = minutesToSec(leftMin);
        const rightSec = minutesToSec(rightMin);

        submit({
          babyId,
          type: "feed_breast",
          startedAt: at,
          endedAt:
            leftSec + rightSec > 0
              ? new Date(at.getTime() + (leftSec + rightSec) * 1000)
              : null,
          note,
          data: {
            left_sec: leftSec,
            right_sec: rightSec,
            last_side: str(d, "last_side"),
          },
        });
        onDone();
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[0.875rem] font-medium text-default">
          כמה זמן בכל צד
        </legend>
        <div className="flex gap-3">
          <NumberField
            label="ימין"
            unit="דק׳"
            value={rightMin}
            onChange={setRightMin}
            placeholder="0"
          />
          <NumberField
            label="שמאל"
            unit="דק׳"
            value={leftMin}
            onChange={setLeftMin}
            placeholder="0"
          />
        </div>
        {totalMin > 0 ? (
          <p className="text-center text-[0.8125rem] text-muted">
            סה״כ <span className="tnum font-medium text-strong">{totalMin}</span> דקות
          </p>
        ) : null}
      </fieldset>

      <TimePicker value={at} onChange={setAt} />
      <NoteField value={note} onChange={setNote} />
      <SaveButton editing={Boolean(initial)} />
    </form>
  );
}

/* -------------------------------------------------------------- חום וגדילה */

export function TemperatureForm({ babyId, submit, initial, onDone }: FormProps) {
  const d = initialData(initial);
  const [celsius, setCelsius] = useState(num(d, "celsius") ?? 36.8);
  const [at, setAt] = useState(startOf(initial));
  const [note, setNote] = useState(initial?.note ?? "");

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
        submit({
          babyId,
          type: "temperature",
          startedAt: at,
          note,
          data: { celsius },
        });
        onDone();
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
      <SaveButton editing={Boolean(initial)} />
    </form>
  );
}

export function GrowthForm({ babyId, submit, initial, onDone, onError }: FormProps) {
  const d = initialData(initial);
  const weight = num(d, "weight_g");
  const [weightKg, setWeightKg] = useState(weight ? (weight / 1000).toFixed(3) : "");
  const [heightCm, setHeightCm] = useState(num(d, "height_cm")?.toString() ?? "");
  const [headCm, setHeadCm] = useState(num(d, "head_cm")?.toString() ?? "");
  const [at, setAt] = useState(startOf(initial));

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
        submit({
          babyId,
          type: "growth",
          startedAt: at,
          data: {
            weight_g: weightKg ? Math.round(parseFloat(weightKg) * 1000) : null,
            height_cm: heightCm ? parseFloat(heightCm) : null,
            head_cm: headCm ? parseFloat(headCm) : null,
          },
        });
        onDone();
      }}
    >
      <NumberField
        label="משקל"
        unit="ק״ג"
        step="0.001"
        placeholder="3.150"
        value={weightKg}
        onChange={setWeightKg}
      />
      <NumberField
        label="אורך"
        unit="ס״מ"
        step="0.1"
        placeholder="50.5"
        value={heightCm}
        onChange={setHeightCm}
      />
      <NumberField
        label="היקף ראש"
        unit="ס״מ"
        step="0.1"
        placeholder="35.0"
        value={headCm}
        onChange={setHeadCm}
      />

      <TimePicker value={at} onChange={setAt} />
      <SaveButton editing={Boolean(initial)} />
    </form>
  );
}

/* ----------------------------------------------------------------- תרופה */

/**
 * רישום תרופה או תוסף.
 *
 * הערך המרכזי כאן הוא לא הרישום אלא **האזהרה**: הורה עייף, בשתיים
 * בלילה, אחרי שבן/בת הזוג כבר נתן/ה מנה — זה בדיוק המצב שבו ניתנת מנה
 * כפולה. המסך אומר מתי ניתנה המנה האחרונה ומתי מותר את הבאה.
 *
 * האתר אינו מחשב מינון ואינו מציע מינון. מינון לתינוק נקבע לפי משקל
 * ובהוראת רופא; כאן רק רושמים מה שכבר ניתן.
 */
export function MedicineForm({
  babyId,
  submit,
  initial,
  onDone,
  onError,
  recentEvents = [],
}: FormProps) {
  const d = initialData(initial);
  const [medicineId, setMedicineId] = useState(
    str(d, "medicine_id") ?? MEDICINES[0].id,
  );
  const [customName, setCustomName] = useState(
    str(d, "medicine_id") === "other" ? (str(d, "name") ?? "") : "",
  );
  const [dose, setDose] = useState(
    num(d, "dose") !== null ? String(num(d, "dose")) : "",
  );
  const medicine = findMedicine(medicineId);
  const [unit, setUnit] = useState(str(d, "unit") ?? medicine.units[0]);
  const [at, setAt] = useState(startOf(initial));
  const [note, setNote] = useState(initial?.note ?? "");

  const now = useNow();
  const check = now
    ? checkDose({
        medicineId,
        // בעריכה לא בודקים מול הרישום של עצמו
        events: recentEvents.filter((e) => e.started_at !== initial?.started_at),
        now,
        minHours: medicine.minHours,
        maxPerDay: medicine.maxPerDay,
      })
    : null;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const name = medicineId === "other" ? customName.trim() : medicine.label;
        if (!name) {
          onError("צריך למלא שם תרופה");
          return;
        }

        submit({
          babyId,
          type: "medicine",
          startedAt: at,
          note,
          data: {
            medicine_id: medicineId,
            name,
            dose: dose ? parseFloat(dose) : null,
            unit,
          },
        });
        onDone();
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[0.875rem] font-medium text-default">מה ניתן</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {MEDICINES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={m.id === medicineId}
              onClick={() => {
                setMedicineId(m.id);
                setUnit(m.units[0]);
              }}
              className={[
                "min-h-tap rounded-md border px-3 text-[0.875rem] transition-colors duration-150",
                m.id === medicineId
                  ? "border-accent bg-accent-soft font-medium text-accent-text"
                  : "border-line bg-surface-card text-default",
              ].join(" ")}
            >
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>

      {medicineId === "other" ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8125rem] text-muted">שם התרופה</span>
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="min-h-tap-comfy rounded-md border border-line bg-surface-sunken px-3 text-[1rem] text-strong"
          />
        </label>
      ) : null}

      {check && check.lastGivenAt ? (
        <div
          role="status"
          className={[
            "rounded-md px-3 py-2.5 text-[0.8125rem] leading-relaxed",
            check.ok && !check.overDailyLimit
              ? "bg-ok-soft text-ok"
              : "bg-late-soft text-late",
          ].join(" ")}
        >
          {!check.ok ? (
            <>
              המנה האחרונה ניתנה לפני{" "}
              {durationHebrew(
                (now!.getTime() - new Date(check.lastGivenAt).getTime()) / 1000,
              )}
              . לפי המרווח המקובל אפשר לתת שוב בעוד{" "}
              {durationHebrew(check.minutesRemaining * 60)}.
            </>
          ) : check.overDailyLimit ? (
            <>
              כבר ניתנו {check.dosesToday} מנות ביממה האחרונה
              {medicine.maxPerDay ? ` (המקובל: עד ${medicine.maxPerDay})` : ""}.
            </>
          ) : (
            <>
              המנה האחרונה ניתנה לפני{" "}
              {durationHebrew(
                (now!.getTime() - new Date(check.lastGivenAt).getTime()) / 1000,
              )}
              . אפשר לתת.
            </>
          )}
        </div>
      ) : null}

      <div className="flex gap-3">
        <NumberField
          label="מינון"
          value={dose}
          onChange={setDose}
          step="0.1"
          placeholder="0"
        />
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[0.8125rem] text-muted">יחידה</span>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="min-h-tap-comfy rounded-md border border-line bg-surface-sunken px-3 text-[1rem] text-strong"
          >
            {medicine.units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
      </div>

      {medicine.note ? (
        <p className="text-[0.75rem] leading-relaxed text-faint">
          {medicine.note}. המינון נקבע לפי משקל ובהוראת רופא — האתר רק רושם.
        </p>
      ) : null}

      <TimePicker value={at} onChange={setAt} />
      <NoteField value={note} onChange={setNote} />
      <SaveButton editing={Boolean(initial)} />
    </form>
  );
}

/* ------------------------------------------------------- הערה ופעילות כללית */

export function SimpleForm({
  babyId,
  submit,
  type,
  initial,
  onDone,
}: FormProps & { type: EventType }) {
  const [note, setNote] = useState(initial?.note ?? "");
  const [at, setAt] = useState(startOf(initial));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit({ babyId, type, startedAt: at, note });
        onDone();
      }}
    >
      <NoteField value={note} onChange={setNote} />
      <TimePicker value={at} onChange={setAt} />
      <SaveButton editing={Boolean(initial)} />
    </form>
  );
}

/** בוחר את הטופס המתאים לסוג האירוע. */
export function FormForType({
  type,
  lastAmountMl,
  ...props
}: FormProps & { type: EventType; lastAmountMl?: number | null }) {
  switch (type) {
    case "diaper":
      return <DiaperForm {...props} />;
    case "feed_bottle":
      return <BottleForm {...props} lastAmountMl={lastAmountMl} />;
    case "pump":
      return <PumpForm {...props} />;
    case "feed_breast":
      return <BreastForm {...props} />;
    case "temperature":
      return <TemperatureForm {...props} />;
    case "growth":
      return <GrowthForm {...props} />;
    case "medicine":
      return <MedicineForm {...props} />;
    default:
      return <SimpleForm {...props} type={type} />;
  }
}
