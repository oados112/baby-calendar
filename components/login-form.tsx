"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { IconBaby } from "@/components/icons";

/**
 * כניסה בקוד אישי.
 *
 * כל אדם מקבל קוד קבוע במקום מייל: אין למה לחכות, אין ספאם ואין תלות
 * בשירות חיצוני. הקוד הוא בפועל סיסמה — הוא נשלח לשרת ונבדק שם מול
 * hash, והדפדפן לא שומר אותו בשום מקום.
 */

const MESSAGES: Record<string, string> = {
  invalid_code: "הקוד אינו נכון. בדקו שהקלדתם אותו במלואו.",
  too_many_attempts: "יותר מדי ניסיונות. נסו שוב בעוד רבע שעה.",
  server_error: "משהו השתבש אצלנו. נסו שוב בעוד רגע.",
};

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const ready = code.trim().length >= 6;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      if (!response.ok) {
        const { error: reason } = await response.json().catch(() => ({}));
        setError(MESSAGES[reason] ?? MESSAGES.server_error);
        setBusy(false);
        return;
      }

      // הסשן נכתב בעוגיות על ידי השרת; רענון כדי שהשרת יזהה אותנו
      router.replace("/");
      router.refresh();
    } catch {
      setError("אין חיבור לרשת. בדקו את החיבור ונסו שוב.");
      setBusy(false);
    }
  }

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12"
    >
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-4 grid size-16 place-items-center rounded-full bg-accent-soft text-accent-text">
          <IconBaby className="size-8" />
        </span>
        <h1 className="text-2xl font-semibold text-strong">היומן של התינוק</h1>
        <p className="mt-1.5 text-[0.9375rem] text-muted">
          מעקב האכלות, שינה וחיתולים — משותף לכל המשפחה
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="access-code"
            className="text-center text-[0.875rem] font-medium text-default"
          >
            הקוד האישי שלך
          </label>
          <input
            id="access-code"
            type="password"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
            autoFocus
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            dir="ltr"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "code-error" : "code-hint"}
            className={[
              "min-h-tap-hero rounded-lg border bg-surface-sunken px-4 text-center",
              // 1rem לפחות, אחרת iOS מגדיל את המסך בכניסה לשדה
              "text-[1.25rem] tracking-[0.12em] text-strong",
              "placeholder:tracking-normal placeholder:text-faint",
              "transition-colors duration-150",
              error ? "border-late" : "border-line focus:border-accent",
            ].join(" ")}
          />
          {error ? (
            <p
              id="code-error"
              role="alert"
              className="text-center text-[0.8125rem] text-late"
            >
              {error}
            </p>
          ) : (
            <p id="code-hint" className="text-center text-[0.8125rem] text-muted">
              הקוד שקיבלתם. אין צורך במייל ואין סיסמה לזכור.
            </p>
          )}
        </div>

        <Button type="submit" fullWidth loading={busy} disabled={!ready}>
          {busy ? "נכנס…" : "כניסה"}
        </Button>
      </form>

      <p className="mt-8 text-center text-[0.75rem] leading-relaxed text-faint">
        האתר פרטי. הכניסה אפשרית רק עם קוד אישי שהונפק מראש.
      </p>
    </main>
  );
}
