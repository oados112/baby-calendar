"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EventList } from "@/components/event-list";
import { deleteEvent, updateEvent, type LogInput } from "@/lib/data/log";
import { deletePhotoQuietly } from "@/lib/photos";
import type { EventRow } from "@/types/db";

/**
 * רשימת היום ביומן.
 *
 * הרשימה **נגזרת מה-props ולא מועתקת ל-state**. זה קריטי: מעבר בין ימים
 * הוא ניווט בתוך אותו עמוד, הרכיב נשאר מחובר, ו-useState(initial) היה
 * נשאר תקוע על היום הראשון שנטען. זה בדיוק הבאג שגרם לכך שסיכום היום
 * התעדכן אבל הרשימה מתחתיו לא.
 *
 * מה שכן נשמר מקומית הוא רק ההבדל מהשרת — מה שנמחק ומה שנערך זה עתה —
 * כדי שהפעולה תיראה מיד. ברגע שהשרת מתעדכן, ההבדל הזה פשוט מתאפס.
 */
export function DayEvents({
  events: fromServer,
  memberNames,
  currentUserId,
  familyId,
  emptyLabel,
}: {
  events: EventRow[];
  memberNames: Record<string, string>;
  currentUserId: string;
  familyId: string;
  emptyLabel: string;
}) {
  const router = useRouter();
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [edited, setEdited] = useState<Record<string, EventRow>>({});
  const [error, setError] = useState<string | null>(null);

  const events = fromServer
    .map((e) => edited[e.id] ?? e)
    .filter((e) => !removed.has(e.id));

  function forget(id: string) {
    setRemoved((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function handleDelete(event: EventRow) {
    setRemoved((current) => new Set(current).add(event.id));
    setError(null);

    deleteEvent(event.id)
      .then(() => {
        // התמונה נמחקת יחד עם הרישום
        if (event.photo_path) deletePhotoQuietly(event.photo_path);
        router.refresh();
      })
      .catch((e: unknown) => {
        // נכשל — מחזירים את השורה למקומה כדי שהמסך לא ישקר
        forget(event.id);
        setError(e instanceof Error ? e.message : "המחיקה נכשלה");
      });
  }

  function handleEdit(event: EventRow, input: LogInput) {
    setEdited((current) => ({
      ...current,
      [event.id]: {
        ...event,
        started_at: input.startedAt.toISOString(),
        ended_at: input.endedAt ? input.endedAt.toISOString() : null,
        data: (input.data ?? {}) as EventRow["data"],
        note: input.note?.trim() || null,
      },
    }));
    setError(null);

    updateEvent(
      event.id,
      {
        startedAt: input.startedAt,
        endedAt: input.endedAt ?? null,
        data: input.data ?? {},
        note: input.note ?? null,
      },
      currentUserId,
    )
      .then(() => router.refresh())
      .catch((e: unknown) => {
        setEdited((current) => {
          const next = { ...current };
          delete next[event.id];
          return next;
        });
        setError(e instanceof Error ? e.message : "העריכה נכשלה");
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
      <EventList
        events={events}
        memberNames={memberNames}
        familyId={familyId}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
    </>
  );
}
