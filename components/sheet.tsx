"use client";

import { useEffect, useRef } from "react";

/**
 * חלונית תחתונה (bottom sheet).
 *
 * כל רישום באתר נפתח דרכה, ולכן היא נושאת את כללי הנגישות פעם אחת:
 * מלכודת מיקוד, סגירה ב-Escape, נעילת גלילת הרקע, והחזרת המיקוד
 * לכפתור שממנו נפתחה. נפתחת מלמטה כי שם נמצא האגודל.
 */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // המיקוד עובר לחלונית, אחרת קורא מסך ממשיך להקריא את הרקע
    panelRef.current?.querySelector<HTMLElement>(
      "input, button, select, textarea, [tabindex]",
    )?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      openerRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        aria-label="סגירה"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-[var(--surface-overlay)] animate-[fade_150ms_ease-out]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative mx-auto max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-subtle bg-surface-raised px-5 pt-3 pb-[calc(1.25rem+var(--safe-bottom))]"
        style={{ boxShadow: "var(--shadow-sheet)" }}
      >
        <div className="sticky top-0 -mx-5 mb-3 bg-surface-raised px-5 pb-2">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />
          <h2 className="text-center text-[1.0625rem] font-semibold text-strong">
            {title}
          </h2>
        </div>
        {children}
      </div>
    </div>
  );
}
