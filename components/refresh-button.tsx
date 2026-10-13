"use client";

import { useEffect, useState } from "react";
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
 *
 * **על המשוב.** סיבוב לבדו אינו מספיק, וזה בדיוק מה שהסתיר את התקלה
 * הקודמת: הוא הסתובב, נעצר, וכלום לא קרה — בדיוק כמו רענון מוצלח
 * שלא מצא שום דבר חדש. לכן הכפתור נגמר בסימן מפורש: וי כשהצליח,
 * קריאה כשנכשל. ההודעה עצמה ("הכל מעודכן" / "נוספו 2 רישומים")
 * נשלחת מהמסך שמעליו, כי שם יודעים מה באמת נכנס.
 */

type Phase = "idle" | "loading" | "done" | "failed";

/** כמה זמן הסימן נשאר אחרי שהרענון נגמר. */
const SIGN_MS = 1400;
/** רענון מהיר מדי נראה כאילו כלום לא קרה. */
const MINIMUM_SPIN_MS = 500;

const PATHS: Record<Phase, string> = {
  idle: "M20 11.5a8 8 0 1 0-2.1 6 M20 5.5v5.5h-5.5",
  loading: "M20 11.5a8 8 0 1 0-2.1 6 M20 5.5v5.5h-5.5",
  done: "M5 12.5l4.5 4.5L19 7.5",
  failed: "M12 7v6 M12 17h.01",
};

export function RefreshButton({
  onRefresh,
}: {
  /** שליפה ישירה של הנתונים. בלעדיה נשארת רק רענון הדף */
  onRefresh?: () => Promise<void>;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (phase !== "done" && phase !== "failed") return;
    const id = setTimeout(() => setPhase("idle"), SIGN_MS);
    return () => clearTimeout(id);
  }, [phase]);

  async function refresh() {
    if (phase === "loading") return;
    setPhase("loading");

    const minimum = new Promise((resolve) => setTimeout(resolve, MINIMUM_SPIN_MS));
    let ok = true;

    try {
      await Promise.all([onRefresh?.(), minimum]);
    } catch {
      // הרשימה נשארת כמו שהיא; הסנכרון החי ימשיך לנסות
      ok = false;
      await minimum;
    }

    router.refresh();
    setPhase(ok ? "done" : "failed");
  }

  const tone =
    phase === "done"
      ? "border-ok/40 bg-ok-soft text-ok"
      : phase === "failed"
        ? "border-late/40 bg-late-soft text-late"
        : "border-subtle bg-surface-card text-muted";

  return (
    <button
      onClick={refresh}
      aria-label="רענון"
      aria-busy={phase === "loading"}
      className={`grid size-11 shrink-0 place-items-center rounded-full border transition-colors duration-200 active:scale-90 ${tone}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={phase === "idle" || phase === "loading" ? 1.75 : 2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={`size-5 ${phase === "loading" ? "animate-spin" : ""}`}
      >
        {PATHS[phase].split(" M").map((d, i) => (
          <path key={i} d={i === 0 ? d : `M${d}`} />
        ))}
      </svg>
    </button>
  );
}
