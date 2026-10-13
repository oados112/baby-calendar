"use client";

import { useEffect, useState } from "react";
import { formatNationalId, maskNationalId } from "@/lib/national-id";

/**
 * תעודת הזהות בכותרת.
 *
 * מוסתרת כברירת מחדל ונחשפת בלחיצה. לא מתוך פרנויה — זה הטלפון שלכם —
 * אלא כי מספר זהות של ילדה אינו דבר שצריך להיות על המסך כשמראים למישהו
 * תמונה, או כשהטלפון מונח על השולחן בחדר ההמתנה.
 *
 * לחיצה נוספת מעתיקה. בדלפק של טיפת חלב מבקשים להקריא או להקליד אותה,
 * והעתקה חוסכת את הקריאה מהמסך ספרה-ספרה.
 *
 * נחשפת לשלושים שניות ואז חוזרת להסתתר לבד.
 */

const REVEAL_SECONDS = 30;

export function BabyId({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    const id = setTimeout(() => setRevealed(false), REVEAL_SECONDS * 1000);
    return () => clearTimeout(id);
  }, [revealed]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  async function tap() {
    if (!revealed) {
      setRevealed(true);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // אין הרשאה ללוח — הספרות ממילא מוצגות ואפשר להקריא אותן
    }
  }

  return (
    <button
      onClick={tap}
      aria-label={revealed ? "העתקת תעודת הזהות" : "הצגת תעודת הזהות"}
      className="tnum mt-0.5 inline-flex items-center gap-1 rounded-md text-[0.75rem] text-faint transition-colors duration-150 active:text-accent-text"
    >
      ת״ז {revealed ? formatNationalId(value) : maskNationalId(value)}
      {copied ? <span className="text-ok">· הועתק</span> : null}
    </button>
  );
}
