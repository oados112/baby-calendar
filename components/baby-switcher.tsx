"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/sheet";
import { IconBaby } from "@/components/icons";
import { babyDisplayName, babyInitial } from "@/lib/baby";
import { babyAgeHebrew } from "@/lib/time";
import { SELECTED_BABY_COOKIE } from "@/lib/babies";

/** רק מה שהמחליף באמת צריך — לא כל שורת התינוק. */
export interface SwitchableBaby {
  id: string;
  name: string | null;
  birth_date: string;
  sex: "male" | "female" | "unspecified" | null;
}

/**
 * מעבר בין ילדים.
 *
 * מוצג רק כשיש יותר מאחד — במשפחה עם תינוק אחד אין כאן שום דבר על
 * המסך. הבחירה נשמרת בעוגייה ולא בכתובת, כדי שהיא תישמר בין המסכים
 * ובין הביקורים בלי שכל קישור באתר יצטרך לסחוב פרמטר.
 */
/**
 * שמירת הבחירה.
 *
 * מחוץ לרכיב בכוונה: כתיבה ל-document.cookie היא פעולה על העולם החיצוני,
 * ומיקומה כאן מפריד בבירור בין רינדור לבין תופעת לוואי.
 */
function rememberBaby(id: string) {
  // שנה שלמה, כדי שהבחירה תחזיק גם אחרי סגירת הדפדפן
  document.cookie = `${SELECTED_BABY_COOKIE}=${id}; path=/; max-age=31536000; SameSite=Lax`;
}

export function BabySwitcher({
  babies,
  selectedId,
}: {
  babies: SwitchableBaby[];
  selectedId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (babies.length < 2) return null;

  function select(id: string) {
    rememberBaby(id);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="החלפת ילד/ה"
        className="grid size-11 shrink-0 place-items-center rounded-full border border-subtle bg-surface-card text-muted"
      >
        {/* שני עיגולים חופפים — סמל מקובל ל"יש עוד אחד מאחורה" */}
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <circle cx="9" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.75" />
          <path
            d="M14 7.5a5 5 0 0 1 0 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open ? (
        <Sheet title="למי רושמים" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-2 pb-2">
            {babies.map((baby) => {
              const initial = babyInitial(baby.name);
              const selected = baby.id === selectedId;

              return (
                <button
                  key={baby.id}
                  onClick={() => select(baby.id)}
                  aria-pressed={selected}
                  className={[
                    "flex min-h-tap-comfy items-center gap-3 rounded-lg border px-3 text-start",
                    "transition-colors duration-150",
                    selected
                      ? "border-accent bg-accent-soft"
                      : "border-line bg-surface-card",
                  ].join(" ")}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-sunken font-semibold text-accent-text">
                    {initial ?? <IconBaby className="size-5" />}
                  </span>
                  <span className="flex-1">
                    <span className="block text-[0.9375rem] font-medium text-strong">
                      {babyDisplayName(baby.name)}
                    </span>
                    <span className="block text-[0.8125rem] text-muted">
                      {babyAgeHebrew(baby.birth_date, baby.sex)}
                    </span>
                  </span>
                  {selected ? (
                    <span aria-hidden className="text-accent-text">
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
