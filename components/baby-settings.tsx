"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BabyRow } from "@/types/db";

/**
 * פרטי התינוק/ת.
 *
 * הכל ניתן לשינוי בכל רגע, כולל השם — כי בימים הראשונים עדיין אין שם,
 * וכשהוא נבחר אין סיבה להקים הכל מחדש. שינוי כאן משנה גם את השם שמופיע
 * בכל המסכים וגם את חישוב הגיל.
 */
export function BabySettings({ baby }: { baby: BabyRow }) {
  const router = useRouter();

  const [name, setName] = useState(baby.name ?? "");
  const [sex, setSex] = useState<"male" | "female" | "unspecified">(
    baby.sex ?? "unspecified",
  );
  const [birthDate, setBirthDate] = useState(baby.birth_date);
  const [birthTime, setBirthTime] = useState(baby.birth_time?.slice(0, 5) ?? "");
  const [weightKg, setWeightKg] = useState(
    baby.birth_weight_g ? (baby.birth_weight_g / 1000).toFixed(3) : "",
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const grams = weightKg ? Math.round(parseFloat(weightKg) * 1000) : null;

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("babies")
      .update({
        name: name.trim() || null,
        sex,
        birth_date: birthDate,
        birth_time: birthTime || null,
        birth_weight_g: Number.isFinite(grams) ? grams : null,
      })
      .eq("id", baby.id);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("נשמר");
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-subtle bg-surface-card p-4">
      <h2 className="text-[0.9375rem] font-semibold text-strong">פרטי התינוק/ת</h2>

      <form onSubmit={save} className="mt-3 flex flex-col gap-4">
        <TextField
          label="שם"
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint="אפשר להשאיר ריק עד שתחליטו"
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[0.875rem] font-medium text-default">מין</legend>
          <div className="flex gap-1.5">
            {(
              [
                { value: "female", label: "בת" },
                { value: "male", label: "בן" },
                { value: "unspecified", label: "לא צוין" },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={sex === o.value}
                onClick={() => setSex(o.value)}
                className={[
                  "min-h-tap flex-1 rounded-md border text-[0.9375rem] transition-colors duration-150",
                  sex === o.value
                    ? "border-accent bg-accent-soft font-medium text-accent-text"
                    : "border-line bg-surface-card text-default",
                ].join(" ")}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-[0.75rem] text-faint">
            משפיע על ניסוח הטקסטים באתר, ויידרש לעקומות אחוזונים בעתיד.
          </p>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="תאריך לידה"
            type="date"
            required
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
          <TextField
            label="שעת לידה"
            type="time"
            value={birthTime}
            onChange={(e) => setBirthTime(e.target.value)}
          />
        </div>

        <TextField
          label="משקל לידה (ק״ג)"
          type="number"
          inputMode="decimal"
          step="0.001"
          placeholder="2.795"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          hint="קו הייחוס בגרף הגדילה"
        />

        <Button type="submit" fullWidth loading={saving}>
          שמירה
        </Button>

        {message ? (
          <p role="status" className="text-center text-[0.8125rem] text-muted">
            {message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
