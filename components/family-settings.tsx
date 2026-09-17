"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { relativeHebrew } from "@/lib/time";
import { useNow } from "@/lib/use-now";
import type { MemberRole } from "@/types/db";

/**
 * ניהול מי נכנס ליומן.
 *
 * כל אדם מקבל קוד אישי משלו ולא קוד משותף — כך אפשר לבטל גישה לאדם
 * אחד בלי לשנות כלום לאחרים, ורואים ליד כל רישום מי באמת רשם אותו.
 *
 * הקוד מוצג פעם אחת בלבד, ברגע היצירה. הוא נשמר כ-hash, ולכן גם לנו
 * אין דרך לשחזר אותו אחר כך — רק להחליף.
 */

export interface CodeRow {
  id: string;
  label: string;
  identity_email: string;
  role: MemberRole;
  can_see_medical: boolean;
  created_at: string;
  last_used_at: string | null;
  use_count: number;
  is_revoked: boolean;
  has_joined: boolean;
}

const ROLE_LABELS: Record<MemberRole, { title: string; hint: string }> = {
  admin: { title: "מנהל", hint: "הכל, כולל ניהול אנשים ומחיקות" },
  logger: {
    title: "רושם",
    hint: "רואה הכל ורושם. עורך רק את מה שהוא רשם, ועד 24 שעות",
  },
  viewer: { title: "צופה", hint: "רואה בלבד, בלי לרשום" },
};

export function FamilySettings({
  codes,
  currentUserId,
}: {
  /** נטען בשרת — אין כאן טעינה בדפדפן ואין הבהוב */
  codes: CodeRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [issued, setIssued] = useState<{ label: string; code: string } | null>(null);
  const now = useNow();

  async function revoke(code: CodeRow) {
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("revoke_access_code", { p_code_id: code.id });
    if (error) setError(error.message);
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-subtle bg-surface-card p-4">
      <h2 className="text-[0.9375rem] font-semibold text-strong">מי נכנס ליומן</h2>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
        לכל אדם קוד אישי משלו. אפשר לבטל גישה לאדם אחד בלי לגעת באחרים.
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-[0.8125rem] text-late">
          {error}
        </p>
      ) : null}

      <ul className="mt-3 flex flex-col gap-2">
        {codes.length === 0 ? (
          <li className="text-[0.8125rem] text-faint">עדיין אין קודים</li>
        ) : (
          codes.map((code) => (
            <li
              key={code.id}
              className="flex items-start gap-3 rounded-md border border-subtle px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[0.9375rem] font-medium text-strong">
                    {code.label}
                  </span>
                  <span className="text-[0.75rem] text-muted">
                    {ROLE_LABELS[code.role].title}
                  </span>
                  {code.is_revoked ? (
                    <span className="text-[0.75rem] text-late">מבוטל</span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[0.75rem] text-faint">
                  {code.last_used_at && now
                    ? `נכנס לאחרונה ${relativeHebrew(code.last_used_at, now)}`
                    : "עדיין לא נכנס"}
                </p>
              </div>

              {!code.is_revoked && code.identity_email ? (
                <RevokeButton label={code.label} onConfirm={() => revoke(code)} />
              ) : null}
            </li>
          ))
        )}
      </ul>

      <Button
        variant="secondary"
        fullWidth
        className="mt-3"
        onClick={() => setAdding(true)}
      >
        הוספת אדם
      </Button>

      {adding ? (
        <AddPersonSheet
          onClose={() => setAdding(false)}
          onCreated={(label, code) => {
            setAdding(false);
            setIssued({ label, code });
            router.refresh();
          }}
        />
      ) : null}

      {issued ? (
        <Sheet title="הקוד נוצר" onClose={() => setIssued(null)}>
          <p className="text-[0.9375rem] leading-relaxed text-muted">
            זה הקוד של {issued.label}. הוא מוצג <strong>פעם אחת בלבד</strong> —
            העתיקו אותו עכשיו ומסרו לו/ה.
          </p>
          <p
            dir="ltr"
            className="my-4 rounded-lg bg-surface-sunken px-4 py-4 text-center text-2xl font-semibold tracking-[0.12em] text-strong"
          >
            {issued.code}
          </p>
          <p className="text-[0.75rem] leading-relaxed text-faint">
            הקוד נשמר מוצפן, ולכן גם לנו אין דרך לשחזר אותו. אם הוא יאבד —
            צרו קוד חדש במקומו.
          </p>
          <Button fullWidth className="mt-4" onClick={() => setIssued(null)}>
            העתקתי
          </Button>
        </Sheet>
      ) : null}

      <p className="mt-3 text-[0.75rem] text-faint">
        מחוברים כרגע עם החשבון שלך ({currentUserId.slice(0, 8)}…)
      </p>
    </section>
  );
}

function RevokeButton({
  label,
  onConfirm,
}: {
  label: string;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="shrink-0 self-center text-[0.8125rem] text-muted underline-offset-2 hover:underline"
      >
        ביטול גישה
      </button>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <span className="text-[0.75rem] text-muted">לבטל את {label}?</span>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="text-[0.8125rem] font-medium text-late"
        >
          כן
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-[0.8125rem] text-muted"
        >
          לא
        </button>
      </div>
    </div>
  );
}

function AddPersonSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (label: string, code: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [role, setRole] = useState<MemberRole>("logger");
  const [medical, setMedical] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !email.trim() || code.trim().length < 6) {
      setError("צריך שם, מזהה, וקוד באורך 6 תווים לפחות");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("create_access_code", {
      p_label: label.trim(),
      p_identity_email: email.trim().toLowerCase(),
      p_code: code.trim(),
      p_role: role,
      p_can_see_medical: medical || role === "admin",
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    onCreated(label.trim(), code.trim());
  }

  return (
    <Sheet title="הוספת אדם" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="שם"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          hint="יופיע ליד כל רישום שהוא/היא יעשו"
          autoFocus
        />

        <TextField
          label="מזהה"
          type="email"
          dir="ltr"
          className="text-start"
          placeholder="grandma@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint="משמש כמזהה פנימי בלבד. שום מייל לא נשלח לכתובת הזו."
        />

        <TextField
          label="הקוד שלו/שלה"
          dir="ltr"
          className="text-start"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          hint="לפחות 6 תווים. תמסרו להם אותו בעצמכם."
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[0.875rem] font-medium text-default">
            רמת הרשאה
          </legend>
          {(["logger", "viewer", "admin"] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={role === r}
              onClick={() => setRole(r)}
              className={[
                "rounded-md border px-3 py-2.5 text-start transition-colors duration-150",
                role === r
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-surface-card",
              ].join(" ")}
            >
              <span className="block text-[0.9375rem] font-medium text-strong">
                {ROLE_LABELS[r].title}
              </span>
              <span className="block text-[0.8125rem] text-muted">
                {ROLE_LABELS[r].hint}
              </span>
            </button>
          ))}
        </fieldset>

        {role !== "admin" ? (
          <label className="flex min-h-tap items-center gap-3 rounded-md border border-line bg-surface-card px-3">
            <input
              type="checkbox"
              checked={medical}
              onChange={(e) => setMedical(e.target.checked)}
              className="size-5 accent-[var(--accent)]"
            />
            <span className="text-[0.875rem] text-default">
              מותר לראות מידע רפואי (חום, תרופות, ביקורי רופא)
            </span>
          </label>
        ) : null}

        {error ? (
          <p role="alert" className="text-[0.8125rem] text-late">
            {error}
          </p>
        ) : null}

        <Button type="submit" fullWidth loading={saving}>
          יצירת הקוד
        </Button>
      </form>
    </Sheet>
  );
}
