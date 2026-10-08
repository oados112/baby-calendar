"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * מעבר בין שלושת המסכים.
 *
 * למעלה ולא למטה: תחתית המסך שמורה לכפתורי הרישום, שהם הפעולה התכופה.
 * ניווט קורה הרבה פחות, ולכן הוא לא מתחרה על אזור האגודל.
 */

const TABS = [
  { href: "/", label: "היום" },
  { href: "/journal", label: "יומן" },
  { href: "/gallery", label: "תמונות" },
  { href: "/stats", label: "מגמות" },
  { href: "/settings", label: "הגדרות" },
];

export function PageNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ניווט"
      className="mx-4 mb-4 flex gap-1 rounded-full bg-surface-card p-1 shadow-[var(--shadow-sm)]"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            // טעינה מראש: העמוד מוכן עוד לפני הלחיצה, כך שהמעבר מיידי
            prefetch
            aria-current={active ? "page" : undefined}
            className={[
              "flex min-h-tap flex-1 items-center justify-center rounded-full px-1 text-[0.8125rem] transition-colors duration-150",
              active
                ? "bg-accent font-semibold text-on-accent"
                : "text-muted",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
