"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { logEvent } from "@/lib/data/log";
import {
  flushQueue,
  initQueue,
  readQueueSize,
  readQueueSizeOnServer,
  subscribeToQueue,
} from "@/lib/offline-queue";

/**
 * פס מצב הסנכרון.
 *
 * מופיע רק כשיש מה לסנכרן — במצב הרגיל הוא לא קיים על המסך בכלל.
 * הוא לא מבקש מהמשתמש לעשות כלום: השליחה החוזרת אוטומטית כשהרשת
 * חוזרת. הוא קיים כדי לענות על השאלה "הרישום שלי נשמר?" בלי לנחש.
 */
export function SyncBanner({ userId }: { userId: string }) {
  const router = useRouter();
  const pending = useSyncExternalStore(
    subscribeToQueue,
    readQueueSize,
    readQueueSizeOnServer,
  );

  useEffect(() => {
    initQueue();

    const attempt = async () => {
      const sent = await flushQueue((input) => logEvent(input, userId));
      // רק אם משהו באמת נשלח — אחרת אין טעם לבנות את הדף מחדש
      if (sent > 0) router.refresh();
    };

    // ניסיון מיידי בטעינה, ואז בכל פעם שהרשת חוזרת או שחוזרים ללשונית
    attempt();

    const onOnline = () => attempt();
    const onVisible = () => {
      if (document.visibilityState === "visible") attempt();
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    // רשת עלולה לחזור בלי לירות אירוע (מעבר בין סלולרי ל-Wi-Fi)
    const interval = setInterval(attempt, 60_000);

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [router, userId]);

  if (pending === 0) return null;

  return (
    <div
      role="status"
      className="mx-4 mb-3 flex items-center gap-2 rounded-md bg-due-soft px-3 py-2 text-[0.8125rem] text-due"
    >
      <span
        aria-hidden
        className="size-2 shrink-0 animate-pulse rounded-full bg-due"
      />
      <span>
        {pending === 1
          ? "רישום אחד ממתין לסנכרון"
          : `${pending} רישומים ממתינים לסנכרון`}{" "}
        — יישלח לבד כשהרשת תחזור
      </span>
    </div>
  );
}
