"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSiteOrigin } from "@/lib/config";
import { Button, TextField } from "@/components/ui";
import { IconBaby } from "@/components/icons";

/**
 * תרגום שגיאות Supabase להודעה שאפשר לפעול לפיה.
 *
 * באתר ציבורי היינו מסתירים את ההבדל בין "כתובת לא מורשית" ל"תקלה", כדי
 * לא לאפשר גילוי משתמשים. כאן הרשימה סגורה וידועה לשני ההורים, ולכן
 * הודעה מדויקת שווה הרבה יותר מהסתרה שלא מגינה על אף אחד.
 */
function describeAuthError(message: string, status?: number): string {
  const m = message.toLowerCase();

  // הטריגר של הרשימה הלבנה דוחה יצירת משתמש
  if (m.includes("database error saving new user")) {
    return "הכתובת הזו אינה ברשימת המורשים. בדקו שהקלדתם נכון, או בקשו הזמנה.";
  }
  if (m.includes("rate limit") || status === 429) {
    return "נשלחו יותר מדי בקשות. נסו שוב בעוד כמה דקות.";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "כתובת המייל אינה תקינה.";
  }
  if (m.includes("signups not allowed") || m.includes("disabled")) {
    return "ההרשמה סגורה כרגע. פנו למנהל היומן.";
  }
  return "לא הצלחנו לשלוח את הקישור. נסו שוב בעוד רגע.";
}

/**
 * התחברות בקישור למייל (Magic Link).
 *
 * אין סיסמאות: אין מה לשכוח, אין מה לגנוב, ואין מה לנהל.
 * ההגנה האמיתית היא הרשימה הלבנה בבסיס הנתונים — כתובת שאינה מורשית
 * לא תיצור משתמש גם אם תבקש קישור.
 */
export function LoginForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address) return;

    setStatus("sending");
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: `${getSiteOrigin()}/auth/callback` },
    });

    if (error) {
      setStatus("idle");
      setError(describeAuthError(error.message, error.status));
      return;
    }

    setStatus("sent");
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
          מעקב האכלות, שינה וחיתולים — משותף לשניכם
        </p>
      </div>

      {status === "sent" ? (
        <div
          role="status"
          className="rounded-lg border border-subtle bg-surface-card p-5 text-center"
        >
          <h2 className="text-[1.0625rem] font-semibold text-strong">
            הקישור בדרך אליכם
          </h2>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
            שלחנו מייל ל־<span className="text-default">{email.trim()}</span>.
            פתחו אותו מהמכשיר הזה כדי להיכנס.
          </p>
          <p className="mt-3 text-[0.8125rem] text-faint">
            לא הגיע? בדקו בספאם, או המתינו דקה ונסו שוב.
          </p>
          <Button
            variant="ghost"
            fullWidth
            className="mt-4"
            onClick={() => setStatus("idle")}
          >
            שליחה לכתובת אחרת
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <TextField
            label="כתובת המייל"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            dir="ltr"
            className="text-start"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
            hint="נשלח אליכם קישור כניסה. אין צורך בסיסמה."
          />
          <Button type="submit" fullWidth loading={status === "sending"}>
            {status === "sending" ? "שולח…" : "שליחת קישור כניסה"}
          </Button>
        </form>
      )}

      <p className="mt-8 text-center text-[0.75rem] leading-relaxed text-faint">
        האתר פרטי. רק כתובות שאושרו מראש יכולות להיכנס.
      </p>
    </main>
  );
}
