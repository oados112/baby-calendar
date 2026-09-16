"use client";

import { useState } from "react";
import { EventList } from "@/components/event-list";
import { deleteEvent } from "@/lib/data/log";
import type { EventRow } from "@/types/db";

/**
 * רשימת היום ביומן.
 *
 * עוטף את EventList במצב מקומי כדי שמחיקה תיעלם מהמסך מיד, בלי לחכות
 * לשרת ובלי לבנות את הדף מחדש.
 */
export function DayEvents({
  events: initial,
  memberNames,
  emptyLabel,
}: {
  events: EventRow[];
  memberNames: Record<string, string>;
  emptyLabel: string;
}) {
  const [events, setEvents] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function handleDelete(event: EventRow) {
    setEvents((current) => current.filter((e) => e.id !== event.id));
    setError(null);

    deleteEvent(event.id).catch((e: unknown) => {
      // נכשל — מחזירים את השורה למקומה כדי שהמסך לא ישקר
      setEvents((current) =>
        current.some((x) => x.id === event.id)
          ? current
          : [event, ...current].sort((a, b) =>
              b.started_at.localeCompare(a.started_at),
            ),
      );
      setError(e instanceof Error ? e.message : "המחיקה נכשלה");
    });
  }

  if (events.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-[0.9375rem] text-muted">
        {emptyLabel}
      </p>
    );
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-2 text-[0.8125rem] text-late">
          {error}
        </p>
      ) : null}
      <EventList events={events} memberNames={memberNames} onDelete={handleDelete} />
    </>
  );
}
