/**
 * שלד טעינה.
 *
 * מוצג ברגע שלוחצים על ניווט, לפני שהנתונים הגיעו. הערך שלו אינו
 * ויזואלי אלא תחושתי: מסך שמגיב מיד נתפס כמהיר גם אם הנתונים מגיעים
 * באותו זמן בדיוק. הוא גם שומר על אותו גובה, כך שהתוכן לא "קופץ".
 */

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-lg bg-surface-sunken ${className}`}
    />
  );
}

export function SkeletonHeader() {
  return (
    <header className="flex items-center gap-3 px-4 pt-[calc(1rem+var(--safe-top))] pb-3">
      <SkeletonBlock className="size-11 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5">
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className="h-3 w-32" />
      </div>
    </header>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <div className="flex flex-1 flex-col gap-1.5">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-3 w-40" />
          </div>
          <SkeletonBlock className="size-9 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** מעטפת עם אזור חי לקוראי מסך, כדי שגם הם יידעו שהדף נטען. */
export function SkeletonPage({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="טוען"
      className="mx-auto flex min-h-dvh w-full max-w-lg flex-col"
    >
      {children}
    </div>
  );
}
