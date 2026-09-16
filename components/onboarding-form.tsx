"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button, TextField } from "@/components/ui";
import { IconBaby } from "@/components/icons";

/**
 * הקמה ראשונית: משפחה + תינוק.
 *
 * הכל חוץ מתאריך הלידה הוא אופציונלי. בימים הראשונים אחרי לידה אין
 * סבלנות לטופס, ולרוב עדיין אין שם — אז לא חוסמים על זה.
 */
export function OnboardingForm({ defaultDisplayName }: { defaultDisplayName: string }) {
  const router = useRouter();

  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [babyName, setBabyName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!birthDate) {
      setError("תאריך הלידה נחוץ לחישוב הגיל והאחוזונים");
      return;
    }

    setSaving(true);
    setError(null);

    const grams = weightKg ? Math.round(parseFloat(weightKg) * 1000) : null;

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("create_family_with_baby", {
      // שם המשפחה אינו נשאל בהקמה — אפשר לשנות אותו אחר כך בהגדרות
      p_family_name: "המשפחה שלנו",
      p_display_name: displayName.trim() || "הורה",
      p_baby_name: babyName.trim() || null,
      p_birth_date: birthDate,
      p_birth_time: birthTime || null,
      p_birth_weight_g: Number.isFinite(grams) ? grams : null,
    });

    if (error) {
      setSaving(false);
      setError(error.message);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12"
    >
      <div className="mb-7 flex flex-col items-center text-center">
        <span className="mb-4 grid size-16 place-items-center rounded-full bg-accent-soft text-accent-text">
          <IconBaby className="size-8" />
        </span>
        <h1 className="text-2xl font-semibold text-strong">כמה פרטים ומתחילים</h1>
        <p className="mt-1.5 text-[0.9375rem] text-muted">
          אפשר לשנות הכל אחר כך. רק תאריך הלידה חובה.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="איך לקרוא לך"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          hint="השם הזה יופיע ליד כל רישום שתעשה"
          autoComplete="given-name"
        />

        <TextField
          label="שם התינוק/ת"
          value={babyName}
          onChange={(e) => setBabyName(e.target.value)}
          hint="עדיין אין שם? אפשר להשאיר ריק ולהוסיף מתי שתחליטו"
        />

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
          min="0.2"
          max="10"
          placeholder="2.795"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          hint="הנקודה הראשונה בגרף הגדילה"
        />

        {error ? (
          <p role="alert" className="text-[0.8125rem] text-late">
            {error}
          </p>
        ) : null}

        <Button type="submit" fullWidth loading={saving} className="mt-1">
          {saving ? "יוצר…" : "יאללה, מתחילים"}
        </Button>
      </form>
    </main>
  );
}
