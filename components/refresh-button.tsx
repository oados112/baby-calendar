"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * רענון ידני.
 *
 * למה זה נחוץ: כשהאתר מותקן במסך הבית באייפון, ספארי לא נותן משיכה
 * לרענון — אין סרגל כתובת ואין מחוות רענון. בלי הכפתור הזה אין שום
 * דרך לבקש נתונים טריים חוץ מלסגור ולפתוח את האפליקציה.
 *
 * **מה שהוא עושה בפועל** הוא לשלוף את הרישומים מחדש מ-Supabase ולהחליף
 * את מה שעל המסך. הגרסה הקודמת קראה רק ל-router.refresh(), וזה לא
 * הספיק: באתר מותקן הבקשה לא תמיד מגיעה לשרת, והלחיצה נראתה כאילו
 * לא קרה כלום. router.refresh() עדיין נקרא אחריו, בשביל החלקים
 * שמגיעים מהשרת — כרטיס החיסונים, סל התרופות — אבל הוא כבר לא
 * האחראי היחיד, ואם ייכשל הרשימה כבר התעדכנה.
 */
export function RefreshButton({
  onRefresh,
}: {
  /** שליפה ישירה של הנתונים. בלעדיה נשארת רק רענון הדף */
  onRefresh?: () => Promise<void>;
}) {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  async function refresh() {
    if (spinning) return;
    setSpinning(true);

    // סיבוב מינימלי של חצי שנייה: רענון מהיר מדי נראה כאילו כלום לא קרה
    const minimum = new Promise((resolve) => setTimeout(resolve, 550));

    try {
      await Promise.all([onRefresh?.(), minimum]);
    } catch {
      // הרשימה נשארת כמו שהיא; הסנכרון החי ימשיך לנסות
    }

    router.refresh();
    setSpinning(false);
  }

  return (
    <button
      onClick={refresh}
      aria-label="רענון"
      aria-busy={spinning}
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
