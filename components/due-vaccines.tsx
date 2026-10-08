"use client";

import Link from "next/link";
import { IconMedicine } from "@/components/icons";
import type { VaccineItem } from "@/lib/vaccines";
import { longDate } from "@/lib/zoned";

/**
 * חיסון שהגיע זמנו.
 *
 * מופיע רק כשיש מה לעשות, כמו כרטיס התרופות. ההבדל הוא שחיסון אינו
 * משהו שרושמים בלחיצה מהבית — הולכים לטיפת חלב — ולכן זה קישור
 * ללוח ולא כפתור רישום.
 *
 * מגיע מחושב מהשרת. חיסון שניתן לפני חודשיים אינו בעמוד הרישומים
 * שנטען למסך הבית, ולכן חישוב בצד הלקוח היה מראה "באיחור" על משהו
 * שכבר ניתן.
 */
export function DueVaccines({ pending }: { pending: VaccineItem[] }) {
  if (pending.length === 0) return null;

  const overdue = pending.some((i) => i.state === "overdue");
  const names = [...new Set(pending.map((i) => i.dose.name))].join(" · ");

  return (
    <Link
      href="/vaccines"
      className={[
        "mb-4 flex items-center gap-3 rounded-lg border p-3",
        "transition-transform duration-150 active:scale-[0.99]",
        overdue
          ? "border-late/30 bg-late-soft"
          : "border-due/30 bg-due-soft",
      ].join(" ")}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-card text-health">
        <IconMedicine className="size-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-medium text-strong">
          {overdue ? "חיסון באיחור" : "חיסון בגיל הזה"}
        </span>
        <span className="block text-[0.8125rem] text-muted">{names}</span>
        {pending[0].dueOn ? (
          <span className="tnum block text-[0.75rem] text-faint">
            לפי הלוח: {longDate(pending[0].dueOn)}
          </span>
        ) : null}
      </span>

      <span className="shrink-0 text-[0.8125rem] text-accent-text">ללוח</span>
    </Link>
  );
}
