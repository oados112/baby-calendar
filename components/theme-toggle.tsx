"use client";

import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { useThemePreference, describeResolved } from "@/lib/use-theme";
import type { ThemePreference } from "@/lib/theme";

/**
 * בחירת ערכת נושא.
 *
 * ארבע אפשרויות ולא מתג דו-מצבי, כי "לילה" איננו סתם כהה יותר: הוא מסך
 * שחור בגוונים חמים ובבהירות נמוכה, שנועד להאכלה ב-3 לפנות בוקר בלי
 * לסנוור ובלי להעיר את התינוק. זה שימוש אחר לגמרי ממצב ערב רגיל.
 */

const OPTIONS: {
  value: ThemePreference;
  label: string;
  hint: string;
  swatch: string;
}[] = [
  {
    value: "auto",
    label: "אוטומטי",
    hint: "יום, ערב ולילה לפי השעה והמכשיר",
    swatch: "linear-gradient(135deg, #faf9f7 0 50%, #0e0b09 50% 100%)",
  },
  { value: "light", label: "יום", hint: "בהיר", swatch: "#faf9f7" },
  { value: "dark", label: "ערב", hint: "כהה רגיל", swatch: "#1c1917" },
  {
    value: "night",
    label: "לילה",
    hint: "שחור וחם, לא מסנוור",
    swatch: "linear-gradient(135deg, #000 0 60%, #c2895a 60% 100%)",
  },
];

export function ThemeToggle() {
  const [open, setOpen] = useState(false);
  const [preference, setPreference] = useThemePreference();

  const active = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[0];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`ערכת נושא: ${active.label}`}
        className="grid size-11 shrink-0 place-items-center rounded-full border border-subtle bg-surface-card"
      >
        <span
          aria-hidden
          className="size-5 rounded-full border border-line"
          style={{ background: active.swatch }}
        />
      </button>

      {open ? (
        <Sheet title="ערכת נושא" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-2 pb-2">
            {OPTIONS.map((option) => {
              const selected = option.value === preference;
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    setPreference(option.value);
                    setOpen(false);
                  }}
                  aria-pressed={selected}
                  className={[
                    "flex min-h-tap-comfy items-center gap-3 rounded-lg border px-3 text-start",
                    "transition-colors duration-150",
                    selected
                      ? "border-accent bg-accent-soft"
                      : "border-line bg-surface-card",
                  ].join(" ")}
                >
                  <span
                    aria-hidden
                    className="size-7 shrink-0 rounded-full border border-line"
                    style={{ background: option.swatch }}
                  />
                  <span className="flex-1">
                    <span className="block text-[0.9375rem] font-medium text-strong">
                      {option.label}
                    </span>
                    <span className="block text-[0.8125rem] text-muted">
                      {option.hint}
                      {selected && option.value === "auto"
                        ? ` · ${describeResolved("auto")}`
                        : ""}
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
