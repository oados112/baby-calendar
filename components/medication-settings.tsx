"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  describeDose,
  describeSchedule,
  DOSE_UNITS,
  type MedicationPlan,
} from "@/lib/medication-plans";
import type { MedicationPlanRow } from "@/types/db";

/**
 * סל התרופות והוויטמינים.
 *
 * ההבחנה המרכזית כאן היא בין תרופה **קבועה** לתרופה **לפי הצורך**, והיא
 * לא קוסמטית:
 *
 *   ויטמין D ניתן כל יום. אם עברו 24 שעות ולא ניתן — זו החמצה, ונכון
 *   להזכיר.
 *
 *   אקמול ניתן רק כשיש חום. התראה "עברו שש שעות, הגיע הזמן לעוד" דוחפת
 *   לתת תרופה שאין בה צורך. לכן על תרופה לפי הצורך **לא מתריעים בכלל** —
 *   רק חוסמים מנה מוקדמת מדי בזמן הרישום.
 */

export function MedicationSettings({
  babyId,
  plans: initialPlans,
}: {
  babyId: string;
  plans: MedicationPlanRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<MedicationPlanRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = initialPlans.filter((p) => p.is_active);

  async function toggleReminder(plan: MedicationPlanRow, enabled: boolean) {
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("medication_plans")
      .update({ reminder_enabled: enabled })
      .eq("id", plan.id);

    if (error) setError(error.message);
    router.refresh();
  }

  async function deactivate(plan: MedicationPlanRow) {
    setError(null);
    const supabase = getSupabaseBrowserClient();
    // כיבוי ולא מחיקה: המנות שכבר נרשמו נשארות בהיסטוריה ובסיכום לרופא
    const { error } = await supabase
      .from("medication_plans")
      .update({ is_active: false })
      .eq("id", plan.id);

    if (error) setError(error.message);
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-subtle bg-surface-card p-4">
      <h2 className="text-[0.9375rem] font-semibold text-strong">
        תרופות וויטמינים
      </h2>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
        מה שהתינוק/ת אמור/ה לקבל באופן קבוע. האתר יזכיר כשהגיע הזמן ולא נרשם.
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-[0.8125rem] text-late">
          {error}
        </p>
      ) : null}

      <ul className="mt-3 flex flex-col gap-2">
        {active.length === 0 ? (
          <li className="text-[0.8125rem] text-faint">עדיין לא הוגדר כלום</li>
        ) : (
          active.map((plan) => (
            <li
              key={plan.id}
              className="rounded-md border border-subtle px-3 py-2.5"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[0.9375rem] font-medium text-strong">
                      {plan.name}
                    </span>
                    <span className="text-[0.75rem] text-muted">
                      {plan.kind === "vitamin" ? "ויטמין" : "תרופה"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[0.8125rem] text-muted">
                    {[
                      describeDose(plan as MedicationPlan),
                      describeSchedule(plan as MedicationPlan),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {plan.ends_on ? (
                    <p className="mt-0.5 text-[0.75rem] text-faint">
                      עד {plan.ends_on}
                    </p>
                  ) : null}
                </div>

                <button
                  onClick={() => setEditing(plan)}
                  className="shrink-0 self-center text-[0.8125rem] text-accent-text underline-offset-2 hover:underline"
                >
                  עריכה
                </button>
              </div>

              {plan.schedule === "as_needed" ? (
                <p className="mt-2 text-[0.75rem] text-faint">
                  ניתנת לפי הצורך — לא תישלח עליה תזכורת, רק אזהרה אם המנה
                  הקודמת הייתה קרובה מדי.
                </p>
              ) : (
                <label className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={plan.reminder_enabled}
                    onChange={(e) => toggleReminder(plan, e.target.checked)}
                    className="size-4 accent-[var(--accent)]"
                  />
                  <span className="text-[0.8125rem] text-default">
                    להזכיר כשהגיע הזמן
                  </span>
                </label>
              )}
            </li>
          ))
        )}
      </ul>

      <Button
        variant="secondary"
        fullWidth
        className="mt-3"
        onClick={() => setEditing("new")}
      >
        הוספת תרופה או ויטמין
      </Button>

      {editing ? (
        <PlanSheet
          babyId={babyId}
          plan={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
          onDeactivate={
            editing === "new"
              ? undefined
              : () => {
                  deactivate(editing);
                  setEditing(null);
                }
          }
        />
      ) : null}
    </section>
  );
}

function PlanSheet({
  babyId,
  plan,
  onClose,
  onSaved,
  onDeactivate,
}: {
  babyId: string;
  plan: MedicationPlanRow | null;
  onClose: () => void;
  onSaved: () => void;
  onDeactivate?: () => void;
}) {
  const [kind, setKind] = useState<"vitamin" | "medicine">(plan?.kind ?? "vitamin");
  const [name, setName] = useState(plan?.name ?? "");
  const [dose, setDose] = useState(
    plan?.dose_amount !== null && plan?.dose_amount !== undefined
      ? String(plan.dose_amount)
      : "",
  );
  const [unit, setUnit] = useState(plan?.dose_unit ?? DOSE_UNITS[0]);
  const [schedule, setSchedule] = useState<"interval" | "daily_at" | "as_needed">(
    plan?.schedule ?? "daily_at",
  );
  const [everyHours, setEveryHours] = useState(
    plan?.every_hours ? String(plan.every_hours) : "8",
  );
  const [dailyAt, setDailyAt] = useState(plan?.daily_at?.slice(0, 5) ?? "10:00");
  const [maxPerDay, setMaxPerDay] = useState(
    plan?.max_per_day ? String(plan.max_per_day) : "",
  );
  const [endsOn, setEndsOn] = useState(plan?.ends_on ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("צריך שם");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      baby_id: babyId,
      kind,
      name: name.trim(),
      dose_amount: dose ? Number(dose) : null,
      dose_unit: dose ? unit : null,
      schedule,
      every_hours: schedule === "interval" ? Number(everyHours) : null,
      daily_at: schedule === "daily_at" ? dailyAt : null,
      max_per_day: maxPerDay ? Number(maxPerDay) : null,
      ends_on: endsOn || null,
      is_active: true,
    };

    const supabase = getSupabaseBrowserClient();
    const { error } = plan
      ? await supabase.from("medication_plans").update(payload).eq("id", plan.id)
      : await supabase.from("medication_plans").insert(payload);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    onSaved();
  }

  return (
    <Sheet title={plan ? `עריכת ${plan.name}` : "תרופה או ויטמין"} onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <fieldset className="flex gap-1.5">
          <legend className="mb-1 text-[0.875rem] font-medium text-default">סוג</legend>
          {(
            [
              { value: "vitamin", label: "ויטמין / תוסף" },
              { value: "medicine", label: "תרופה" },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={kind === o.value}
              onClick={() => setKind(o.value)}
              className={[
                "min-h-tap flex-1 rounded-md border text-[0.875rem] transition-colors duration-150",
                kind === o.value
                  ? "border-accent bg-accent-soft font-medium text-accent-text"
                  : "border-line bg-surface-card text-default",
              ].join(" ")}
            >
              {o.label}
            </button>
          ))}
        </fieldset>

        <TextField
          label="שם"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ויטמין D"
          autoFocus={!plan}
        />

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[0.8125rem] text-muted">מינון</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder="400"
              className="min-h-tap-comfy rounded-md border border-line bg-surface-sunken px-3 text-[1rem] text-strong"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[0.8125rem] text-muted">יחידה</span>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="min-h-tap-comfy rounded-md border border-line bg-surface-sunken px-3 text-[1rem] text-strong"
            >
              {DOSE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[0.875rem] font-medium text-default">
            מתי ניתנת
          </legend>
          {(
            [
              {
                value: "daily_at",
                label: "כל יום בשעה קבועה",
                hint: "ויטמין D, ברזל",
              },
              {
                value: "interval",
                label: "כל כמה שעות",
                hint: "קורס אנטיביוטיקה",
              },
              {
                value: "as_needed",
                label: "לפי הצורך",
                hint: "אקמול לחום — לא תישלח תזכורת",
              },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={schedule === o.value}
              onClick={() => setSchedule(o.value)}
              className={[
                "rounded-md border px-3 py-2.5 text-start transition-colors duration-150",
                schedule === o.value
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-surface-card",
              ].join(" ")}
            >
              <span className="block text-[0.9375rem] font-medium text-strong">
                {o.label}
              </span>
              <span className="block text-[0.8125rem] text-muted">{o.hint}</span>
            </button>
          ))}
        </fieldset>

        {schedule === "daily_at" ? (
          <TextField
            label="שעה"
            type="time"
            value={dailyAt}
            onChange={(e) => setDailyAt(e.target.value)}
            hint="שעה קבועה מונעת מהתזכורת לזחול קדימה כל יום"
          />
        ) : null}

        {schedule === "interval" ? (
          <TextField
            label="כל כמה שעות"
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0.5"
            max="168"
            value={everyHours}
            onChange={(e) => setEveryHours(e.target.value)}
          />
        ) : null}

        {schedule !== "as_needed" ? (
          <TextField
            label="עד תאריך (לא חובה)"
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            hint="לקורס שנגמר — התזכורות ייפסקו לבד"
          />
        ) : null}

        <TextField
          label="מקסימום מנות ביממה (לא חובה)"
          type="number"
          inputMode="numeric"
          min="1"
          max="24"
          value={maxPerDay}
          onChange={(e) => setMaxPerDay(e.target.value)}
        />

        <p className="text-[0.75rem] leading-relaxed text-faint">
          המינון והתדירות נקבעים על ידי הרופא או האריזה. האתר רק זוכר מה
          הגדרתם ומזכיר בזמן.
        </p>

        {error ? (
          <p role="alert" className="text-[0.8125rem] text-late">
            {error}
          </p>
        ) : null}

        <Button type="submit" fullWidth loading={saving}>
          שמירה
        </Button>

        {onDeactivate ? (
          <Button variant="secondary" fullWidth onClick={onDeactivate}>
            הפסקת המעקב
          </Button>
        ) : null}
      </form>
    </Sheet>
  );
}
