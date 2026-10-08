"use client";

import { IconClock } from "@/components/icons";
import { feedRhythm } from "@/lib/rhythm";
import { formatClock } from "@/lib/time";
import { useNow } from "@/lib/use-now";
import type { EventRow } from "@/types/db";

/**
 * שורת הקצב.
 *
 * "לפני שעתיים" הוא מספר; "בעוד 35 דקות" הוא תשובה. השורה הזו הופכת את
 * ההיסטוריה שכבר נרשמה לדבר היחיד שרוצים לדעת ברגע נתון — אם יש זמן
 * לעשות מקלחת או שעוד מעט מתחילים.
 *
 * מוצגת רק כשיש מספיק היסטוריה לקצב אמיתי, ונעלמת בזמן הנקה —
 * באמצע האכלה אין טעם לנבא את הבאה.
 */

/** "2:40" לשעות, "45 דק׳" לפחות משעה. */
function gapText(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m} דק׳`;
  return `${h}:${String(m).padStart(2, "0")} שע׳`;
}

function minutesText(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} דק׳`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} שע׳` : `${h}:${String(m).padStart(2, "0")} שע׳`;
}

export function RhythmBar({
  events,
  hidden = false,
}: {
  events: EventRow[];
  /** מוסתר כשטיימר האכלה רץ */
  hidden?: boolean;
}) {
  const now = useNow();
  const rhythm = feedRhythm(events);

  // עד שהשעון של הדפדפן זמין אין מה להשוות אליו, והשרת לא אמור
  // לרנדר כאן טקסט שישתנה מיד אחרי ההידרציה
  if (hidden || !rhythm || !now) return null;

  const deltaSec = (rhythm.nextAt.getTime() - now.getTime()) / 1000;
  const overdue = deltaSec < 0;
  // חלון של עשר דקות סביב הצפי — "בעוד דקה" ו"לפני דקה" הם אותו דבר
  const imminent = Math.abs(deltaSec) <= 10 * 60;

  const tone = overdue && !imminent ? "late" : imminent ? "due" : "ok";
  const toneClasses = {
    ok: "border-subtle bg-surface-card text-muted",
    due: "border-due/30 bg-due-soft text-due",
    late: "border-late/30 bg-late-soft text-late",
  }[tone];

  const headline = imminent
    ? "ההאכלה הבאה בערך עכשיו"
    : overdue
      ? `ההאכלה הבאה הייתה צפויה ב-${formatClock(rhythm.nextAt)}`
      : `ההאכלה הבאה בסביבות ${formatClock(rhythm.nextAt)}`;

  const trailing = imminent
    ? null
    : overdue
      ? `באיחור ${minutesText(-deltaSec)}`
      : `בעוד ${minutesText(deltaSec)}`;

  return (
    <div
      className={`mb-4 rounded-lg border px-3.5 py-2.5 ${toneClasses}`}
      suppressHydrationWarning
    >
      <div className="flex items-center gap-2">
        <IconClock className="size-4 shrink-0" aria-hidden />
        <span className="tnum min-w-0 flex-1 text-[0.8125rem] font-semibold">
          {headline}
        </span>
        {trailing ? (
          <span className="tnum shrink-0 text-[0.8125rem] font-semibold">
            {trailing}
          </span>
        ) : null}
      </div>
      {/* הבסיס לתחזית, בשורה שנייה — מי שרוצה לדעת כמה לסמוך עליה
          מוצא אותה, ומי שרק רוצה את השעה לא צריך לקרוא אותה */}
      <p className="tnum mt-0.5 ps-6 text-[0.75rem] opacity-75">
        בדרך כלל כל {gapText(rhythm.gapSec)}
      </p>
    </div>
  );
}
