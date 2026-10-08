"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * רענון ידני.
 *
 * למה זה נחוץ: כשהאתר מותקן במסך הבית באייפון, ספארי לא נותן משיכה
 * לרענון — אין סרגל כתובת ואין מחוות רענון. בלי הכפתור הזה אין שום
 * דרך לבקש נתונים טריים חוץ מלסגור ולפתוח את האפליקציה.
 *
 * הסנכרון החי מכסה את רוב המקרים, אבל כשהחיבור נופל ועולה הוא עלול
 * לפספס עדכון, וזה הגיבוי.
 */
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [minimumSpin, setMinimumSpin] = useState(false);

  function refresh() {
    // סיבוב מינימלי של חצי שנייה: רענון מהיר מדי נראה כאילו כלום לא קרה
    setMinimumSpin(true);
    setTimeout(() => setMinimumSpin(false), 550);
    startTransition(() => router.refresh());
  }

  const spinning = pending || minimumSpin;

  return (
    <button
      onClick={refresh}
      aria-label="רענון"
      className="grid size-11 shrink-0 place-items-center rounded-full border border-subtle bg-surface-card text-muted transition-transform duration-150 active:scale-90"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={`size-5 ${spinning ? "animate-spin" : ""}`}
      >
        <path d="M20 11.5a8 8 0 1 0-2.1 6" />
        <path d="M20 5.5v5.5h-5.5" />
      </svg>
    </button>
  );
}
