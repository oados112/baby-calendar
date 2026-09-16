"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ActiveTimerRow, EventRow } from "@/types/db";

/**
 * הנתונים החיים של מסך הבית.
 *
 * למה זה קיים: קודם כל פעולה קראה ל-router.refresh(), כלומר השרת בנה
 * מחדש את כל הדף והלקוח חיכה לו — כמה שניות עד שרישום הופיע. כאן
 * הרשימה חיה בצד הלקוח:
 *
 *   • רישום מופיע *מיד*, לפני שהשרת ענה (optimistic)
 *   • אם השמירה נכשלה, הרישום נעלם וההודעה מסבירה למה
 *   • עדכון מהמכשיר השני מגיע ב-Realtime ומוחל נקודתית על הרשימה,
 *     בלי בנייה מחדש של הדף
 *
 * התוצאה: הלחיצה מרגישה מיידית, והתעבורה קטנה בהרבה.
 */

/** מזהה זמני לרישום שטרם אושר בשרת. */
const TEMP_PREFIX = "temp-";
export const isPending = (id: string) => id.startsWith(TEMP_PREFIX);

let tempCounter = 0;
export function makeTempId(): string {
  tempCounter += 1;
  return `${TEMP_PREFIX}${tempCounter}`;
}

function sortDesc(events: EventRow[]): EventRow[] {
  return [...events].sort((a, b) => b.started_at.localeCompare(a.started_at));
}

export interface LiveData {
  events: EventRow[];
  timers: ActiveTimerRow[];
  /** מוסיף רישום למסך מיד; מחזיר פונקציות לאישור או לביטול */
  addOptimistic: (event: EventRow) => {
    confirm: (real: EventRow) => void;
    rollback: () => void;
  };
  removeOptimistic: (id: string) => { restore: () => void };
  setTimers: (next: ActiveTimerRow[]) => void;
}

export function useLiveData({
  babyId,
  initialEvents,
  initialTimers,
  enabled = true,
}: {
  babyId: string;
  initialEvents: EventRow[];
  initialTimers: ActiveTimerRow[];
  enabled?: boolean;
}): LiveData {
  const [events, setEvents] = useState<EventRow[]>(() => sortDesc(initialEvents));
  const [timers, setTimers] = useState<ActiveTimerRow[]>(initialTimers);

  // כשהשרת מביא נתונים חדשים (ניווט, רענון) — מתיישרים אליהם,
  // אבל שומרים רישומים שעדיין ממתינים לאישור כדי שלא "יקפצו" מהמסך
  const lastServerEvents = useRef(initialEvents);
  useEffect(() => {
    if (lastServerEvents.current === initialEvents) return;
    lastServerEvents.current = initialEvents;
    setEvents((current) => {
      const pending = current.filter((e) => isPending(e.id));
      return sortDesc([...initialEvents, ...pending]);
    });
  }, [initialEvents]);

  const lastServerTimers = useRef(initialTimers);
  useEffect(() => {
    if (lastServerTimers.current === initialTimers) return;
    lastServerTimers.current = initialTimers;
    setTimers(initialTimers);
  }, [initialTimers]);

  const addOptimistic = useCallback((event: EventRow) => {
    setEvents((current) => sortDesc([event, ...current]));

    return {
      confirm: (real: EventRow) =>
        setEvents((current) =>
          sortDesc(current.map((e) => (e.id === event.id ? real : e))),
        ),
      rollback: () =>
        setEvents((current) => current.filter((e) => e.id !== event.id)),
    };
  }, []);

  const removeOptimistic = useCallback((id: string) => {
    let removed: EventRow | undefined;
    setEvents((current) => {
      removed = current.find((e) => e.id === id);
      return current.filter((e) => e.id !== id);
    });

    return {
      restore: () =>
        setEvents((current) =>
          removed && !current.some((e) => e.id === id)
            ? sortDesc([removed, ...current])
            : current,
        ),
    };
  }, []);

  // סנכרון חי בין המכשירים — החלה נקודתית, בלי בניית דף מחדש
  useEffect(() => {
    if (!enabled) return;
    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`live-${babyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
          filter: `baby_id=eq.${babyId}`,
        },
        (payload) => {
          const row = payload.new as EventRow | null;
          const old = payload.old as { id?: string } | null;

          setEvents((current) => {
            if (payload.eventType === "DELETE" || (row && row.deleted_at)) {
              const id = row?.id ?? old?.id;
              return current.filter((e) => e.id !== id);
            }
            if (!row) return current;
            const without = current.filter((e) => e.id !== row.id);
            return sortDesc([row, ...without]);
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "active_timers",
          filter: `baby_id=eq.${babyId}`,
        },
        (payload) => {
          const row = payload.new as ActiveTimerRow | null;
          const old = payload.old as { id?: string } | null;

          setTimers((current) => {
            if (payload.eventType === "DELETE") {
              return current.filter((t) => t.id !== (row?.id ?? old?.id));
            }
            if (!row) return current;
            const without = current.filter((t) => t.id !== row.id);
            return [...without, row];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [babyId, enabled]);

  return { events, timers, addOptimistic, removeOptimistic, setTimers };
}
