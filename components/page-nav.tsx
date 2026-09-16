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
  { href: "/stats", label: "מגמות" },
];

export function PageNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ניווט"
      className="mx-4 mb-4 flex gap-1 rounded-lg bg-surface-sunken p-1"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={[
              "flex min-h-tap flex-1 items-center justify-center rounded-md text-[0.875rem] transition-colors duration-150",
              active
                ? "bg-surface-card font-semibold text-strong shadow-[var(--shadow-sm)]"
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
