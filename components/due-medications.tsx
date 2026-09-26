"use client";

import { IconMedicine } from "@/components/icons";
import { durationHebrew } from "@/lib/time";
import { useNow } from "@/lib/use-now";
import { describeDose, dueNow, type MedicationPlan } from "@/lib/medication-plans";
import type { EventRow } from "@/types/db";
import type { LogInput } from "@/lib/data/log";

/**
 * תרופות שהגיע זמנן.
 *
 * מופיע **רק כשיש מה לתת**. במצב הרגיל אין כאן שום דבר על המסך, וזה
 * מכוון: מסך הבית נשמר לשאלה "מה עכשיו", ותזכורת שתמיד מוצגת מפסיקה
 * להיקרא אחרי יומיים.
 *
 * "ניתן עכשיו" רושם את המנה עם המינון שהוגדר — לחיצה אחת, בלי טופס.
 */
export function DueMedications({
  plans,
  events,
  timeZone,
  babyId,
  submit,
}: {
  plans: MedicationPlan[];
  events: EventRow[];
  timeZone: string;
  babyId: string;
  submit: (input: LogInput) => void;
}) {
  const now = useNow();
  if (!now || plans.length === 0) return null;

  const due = dueNow(plans, events, timeZone, now);
  if (due.length === 0) return null;

  return (
    <section aria-label="תרופות שהגיע זמנן" className="mb-4 flex flex-col gap-2">
      {due.map(({ plan, overdueMinutes }) => {
        const dose = describeDose(plan);

        return (
          <div
            key={plan.id}
            className="flex items-center gap-3 rounded-lg border border-health/30 bg-health-soft p-3"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-card text-health">
              <IconMedicine className="size-5" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-medium text-strong">
                {plan.name}
                {dose ? <span className="text-muted"> · {dose}</span> : null}
              </p>
              <p className="text-[0.8125rem] text-muted">
                {overdueMinutes < 60
                  ? "הגיע הזמן"
                  : `באיחור של ${durationHebrew(overdueMinutes * 60)}`}
              </p>
            </div>

            <button
              onClick={() =>
                submit({
                  babyId,
                  type: "medicine",
                  startedAt: new Date(),
                  data: {
                    plan_id: plan.id,
                    name: plan.name,
                    dose: plan.dose_amount,
                    unit: plan.dose_unit,
                  },
                })
              }
              className="min-h-tap shrink-0 rounded-md bg-accent px-4 text-[0.875rem] font-semibold text-on-accent transition-transform duration-150 active:scale-95"
            >
              ניתן עכשיו
            </button>
          </div>
        );
      })}
    </section>
  );
}
