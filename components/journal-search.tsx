"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/sheet";
import { EventIcon } from "@/components/event-list";
import { EVENT_META, FAMILY_CLASSES, summarizeEvent } from "@/lib/event-meta";
import { searchEvents } from "@/lib/data/log";
import { formatClock } from "@/lib/time";
import { longDate } from "@/lib/zoned";
import type { EventRow, EventType } from "@/types/db";

/**
 * חיפוש ביומן.
 *
 * השאלה שהוא עונה עליה היא "מתי בפעם האחרונה נתנו אקמול?" — ולכן הוא
 * מחפש בשלושה מקומות: בהערה, בשם התרופה, ובשם סוג הרישום. חיפוש
 * שמוצא רק הערות היה מפספס בדיוק את המקרה הזה.
 *
 * התוצאה אינה נפתחת לעריכה אלא מובילה ליום שבו היא נרשמה. זה מה
 * שבאמת רוצים — להבין מה קרה סביב, לא לגעת ברישום בודד.
 */

const MIN_LENGTH = 2;
const DEBOUNCE_MS = 300;

export function JournalSearchButton({ babyId }: { babyId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-subtle bg-surface-card px-3 py-1.5 text-[0.8125rem] text-muted transition-transform duration-150 active:scale-95"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          aria-hidden
          className="size-4"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        חיפוש
      </button>

      {open ? <SearchSheet babyId={babyId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SearchSheet({ babyId, onClose }: { babyId: string; onClose: () => void }) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  // התוצאה נשמרת יחד עם המחרוזת שהולידה אותה. כך "האם אנחנו מחפשים
  // כרגע" נגזר מהשוואה ולא מ-state נוסף שצריך לאפס בכל שינוי — וגם
  // תוצאה של חיפוש קודם לא נשארת על המסך מתחת למילה חדשה.
  const [hit, setHit] = useState<{ query: string; rows: EventRow[] } | null>(null);
  const [failure, setFailure] = useState<{ query: string; message: string } | null>(
    null,
  );

  const query = term.trim();
  const results = hit?.query === query ? hit.rows : null;
  const error = failure?.query === query ? failure.message : null;
  const searching = query.length >= MIN_LENGTH && results === null && error === null;

  useEffect(() => {
    if (query.length < MIN_LENGTH) return;

    // המתנה קצרה: בלעדיה כל הקשה הייתה שאילתה, וחמש אותיות
    // היו חמש נסיעות לשרת שרק האחרונה בהן מעניינת
    let active = true;

    const id = setTimeout(() => {
      searchEvents(babyId, query)
        .then((rows) => {
          if (active) setHit({ query, rows });
        })
        .catch((e: unknown) => {
          if (!active) return;
          setFailure({
            query,
            message: e instanceof Error ? e.message : "החיפוש נכשל",
          });
        });
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [babyId, query]);

  return (
    <Sheet title="חיפוש ביומן" onClose={onClose}>
      <input
        type="search"
        autoFocus
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="אקמול, פריחה, חיסון…"
        className="min-h-tap-comfy w-full rounded-md border border-line bg-surface-sunken px-3 text-[1rem] text-strong placeholder:text-faint"
      />

      <div className="mt-3 min-h-40">
        {error ? (
          <p role="alert" className="py-6 text-center text-[0.875rem] text-late">
            {error}
          </p>
        ) : query.length < MIN_LENGTH ? (
          <p className="py-6 text-center text-[0.875rem] leading-relaxed text-faint">
            מחפש בהערות, בשמות תרופות ובסוגי הרישומים.
          </p>
        ) : searching ? (
          <p className="py-6 text-center text-[0.875rem] text-muted">מחפש…</p>
        ) : results && results.length === 0 ? (
          <p className="py-6 text-center text-[0.875rem] text-muted">
            לא נמצא כלום ל״{query}״.
          </p>
        ) : (
          <ol className="flex flex-col gap-0.5">
            {results?.map((event) => (
              <ResultRow
                key={event.id}
                event={event}
                onPick={(dayKey) => {
                  onClose();
                  router.push(`/journal?date=${dayKey}`);
                }}
              />
            ))}
          </ol>
        )}
      </div>
    </Sheet>
  );
}

function ResultRow({
  event,
  onPick,
}: {
  event: EventRow;
  onPick: (dayKey: string) => void;
}) {
  const meta = EVENT_META[event.type as EventType];
  const colors = FAMILY_CLASSES[meta.family];
  const summary = summarizeEvent(event.type, event.data);
  const day = event.started_at.slice(0, 10);

  return (
    <li>
      <button
        onClick={() => onPick(day)}
        className="flex w-full items-start gap-3 rounded-md px-1 py-2 text-start transition-colors duration-150 active:bg-surface-sunken"
      >
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-full ${colors.soft} ${colors.text}`}
        >
          <EventIcon type={event.type} className="size-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="text-[0.9375rem] font-medium text-strong">
              {meta.label}
            </span>
            <span className="tnum text-[0.75rem] text-faint">
              {longDate(day)} · {formatClock(new Date(event.started_at))}
            </span>
          </span>
          {summary ? (
            <span className="block text-[0.8125rem] text-muted">{summary}</span>
          ) : null}
          {event.note ? (
            <span className="line-clamp-2 block text-[0.8125rem] text-default">
              {event.note}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
