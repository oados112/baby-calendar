"use client";

import { useState } from "react";
import { Photo } from "@/components/photo";
import { Sheet } from "@/components/sheet";
import { EVENT_META } from "@/lib/event-meta";
import { formatClock } from "@/lib/time";
import { dayKey, longDate, monthLabel } from "@/lib/zoned";
import type { EventType } from "@/types/db";

/**
 * גלריית התמונות.
 *
 * התמונות כבר קיימות — הן תלויות על רישומים ומפוזרות בין מאות שורות
 * יומן. כאן הן רצף אחד, ואפשר פשוט לגלול אחורה ולראות אותה גדלה.
 *
 * מקובצות לחודשים ולא לימים: ביום בודד יש תמונה או שתיים, וכותרת
 * לכל אחת הייתה הופכת את הדף לרשימה במקום לרשת.
 */

export interface GalleryItem {
  id: string;
  type: EventType;
  started_at: string;
  note: string | null;
  photo_path: string | null;
}

export function Gallery({
  items,
  timeZone,
}: {
  items: GalleryItem[];
  /** גבול החודש נקבע לפי אזור הזמן של המשפחה, לא לפי UTC */
  timeZone: string;
}) {
  const [open, setOpen] = useState<GalleryItem | null>(null);

  const withPhotos = items.filter(
    (i): i is GalleryItem & { photo_path: string } => Boolean(i.photo_path),
  );

  if (withPhotos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-12 text-center text-[0.9375rem] leading-relaxed text-muted">
        עדיין אין תמונות.
        <br />
        אפשר לצרף תמונה לכל רישום — גם לחיתול, גם למדידה.
      </p>
    );
  }

  const groups: { key: string; items: (GalleryItem & { photo_path: string })[] }[] = [];
  for (const item of withPhotos) {
    const key = dayKey(new Date(item.started_at), timeZone).slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.key}>
            <h2 className="mb-2 text-[0.875rem] font-semibold text-muted">
              {/* monthLabel מצפה למפתח יום מלא */}
              {monthLabel(`${group.key}-01`)}
            </h2>
            <div className="grid grid-cols-3 gap-1.5">
              {group.items.map((item) => (
                <Photo
                  key={item.id}
                  path={item.photo_path}
                  alt={`${EVENT_META[item.type].label}, ${longDate(dayKey(new Date(item.started_at), timeZone))}`}
                  className="aspect-square w-full rounded-md"
                  onClick={() => setOpen(item)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {open?.photo_path ? (
        <Sheet title={EVENT_META[open.type].label} onClose={() => setOpen(null)}>
          <Photo
            path={open.photo_path}
            alt={EVENT_META[open.type].label}
            className="max-h-[60dvh] w-full rounded-lg"
          />
          <p className="tnum mt-3 text-center text-[0.875rem] text-muted">
            {longDate(dayKey(new Date(open.started_at), timeZone))} ·{" "}
            {formatClock(new Date(open.started_at))}
          </p>
          {open.note ? (
            <p className="mt-2 rounded-md bg-surface-sunken px-3 py-2.5 text-[0.9375rem] leading-relaxed text-default">
              {open.note}
            </p>
          ) : null}
        </Sheet>
      ) : null}
    </>
  );
}
