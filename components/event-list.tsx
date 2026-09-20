"use client";

import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { FormForType } from "@/components/log-forms";
import { Photo } from "@/components/photo";
import { Button } from "@/components/ui";
import {
  IconActivity,
  IconBottle,
  IconBreast,
  IconDiaper,
  IconGrowth,
  IconMedicine,
  IconNote,
  IconSleep,
  IconSolids,
  IconTemp,
} from "@/components/icons";
import { EVENT_META, FAMILY_CLASSES, summarizeEvent } from "@/lib/event-meta";
import { durationHebrew, formatClock, relativeHebrew } from "@/lib/time";
import { isPending } from "@/lib/use-live-data";
import { useNow } from "@/lib/use-now";
import type { LogInput } from "@/lib/data/log";
import { dayKey, longDate, shiftDayKey } from "@/lib/zoned";
import type { EventRow, EventType } from "@/types/db";

const ICONS: Partial<
  Record<EventType, React.ComponentType<React.SVGProps<SVGSVGElement>>>
> = {
  feed_breast: IconBreast,
  feed_bottle: IconBottle,
  pump: IconBreast,
  solids: IconSolids,
  drink: IconBottle,
  diaper: IconDiaper,
  sleep: IconSleep,
  temperature: IconTemp,
  medicine: IconMedicine,
  vaccine: IconMedicine,
  doctor: IconMedicine,
  growth: IconGrowth,
  activity: IconActivity,
  milestone: IconActivity,
};

export function EventIcon({
  type,
  className,
}: {
  type: EventType;
  className?: string;
}) {
  const C = ICONS[type] ?? IconNote;
  return <C className={className ?? "size-4.5"} />;
}

/**
 * רשימת רישומים.
 *
 * כל שורה נלחצת ופותחת את פרטי הרישום, ומשם אפשר למחוק. מחיקה בשתי
 * לחיצות ולא באחת, ועם אפשרות ביטול — הרישומים האלה נעשים בעייפות,
 * וטעות לא צריכה להיות סופית.
 */
export function EventList({
  events,
  memberNames,
  onDelete,
  onEdit,
  canDelete = true,
  timeZone,
  familyId,
}: {
  events: EventRow[];
  /** נדרש כדי לאפשר החלפת תמונה בעריכה */
  familyId: string;
  memberNames: Record<string, string>;
  onDelete?: (event: EventRow) => void;
  /** שמירת עריכה. בלעדיו לא מוצג כפתור עריכה. */
  onEdit?: (event: EventRow, input: LogInput) => void;
  canDelete?: boolean;
  /** מקבץ לפי ימים עם כותרת תאריך. דורש אזור זמן. */
  timeZone?: string;
}) {
  const [open, setOpen] = useState<EventRow | null>(null);
  const [editing, setEditing] = useState(false);

  function close() {
    setOpen(null);
    setEditing(false);
  }

  return (
    <>
      {timeZone ? (
        <DayGroups
          events={events}
          timeZone={timeZone}
          memberNames={memberNames}
          onOpen={setOpen}
        />
      ) : (
        <ol className="relative space-y-0.5">
          <span
            aria-hidden
            className="absolute top-3 bottom-3 end-[1.375rem] w-px bg-subtle"
          />
          {events.map((event) => (
            <Row
              key={event.id}
              event={event}
              memberNames={memberNames}
              onOpen={setOpen}
            />
          ))}
        </ol>
      )}

      {open ? (
        editing ? (
          <Sheet title={`עריכת ${EVENT_META[open.type].label}`} onClose={close}>
            <FormForType
              type={open.type}
              babyId={open.baby_id}
              familyId={familyId}
              initial={open}
              recentEvents={events}
              submit={(input) => onEdit?.(open, input)}
              onDone={close}
              onError={() => {}}
            />
          </Sheet>
        ) : (
          <DetailSheet
            event={open}
            memberNames={memberNames}
            canDelete={canDelete && !isPending(open.id)}
            canEdit={Boolean(onEdit) && !isPending(open.id)}
            onClose={close}
            onEdit={() => setEditing(true)}
            onDelete={() => {
              const target = open;
              close();
              onDelete?.(target);
            }}
          />
        )
      ) : null}
    </>
  );
}

/** כותרת יום אנושית: "היום" / "אתמול" / "יום רביעי, 16 בספטמבר". */
function dayHeading(key: string, todayKey: string): string {
  if (key === todayKey) return "היום";
  if (key === shiftDayKey(todayKey, -1)) return "אתמול";
  return longDate(key);
}

/**
 * מקבץ את הרישומים לימים.
 *
 * הגבול בין ימים נקבע לפי אזור הזמן של המשפחה ולא לפי UTC — אחרת האכלה
 * ב-01:30 הייתה מופיעה תחת היום הקודם.
 */
function DayGroups({
  events,
  timeZone,
  memberNames,
  onOpen,
}: {
  events: EventRow[];
  timeZone: string;
  memberNames: Record<string, string>;
  onOpen: (e: EventRow) => void;
}) {
  const now = useNow();
  // עד שהשעון של הדפדפן זמין, היום הראשון ברשימה משמש כעוגן
  const todayKey = now
    ? dayKey(now, timeZone)
    : events[0]
      ? dayKey(new Date(events[0].started_at), timeZone)
      : "";

  const groups: { key: string; items: EventRow[] }[] = [];
  for (const event of events) {
    const key = dayKey(new Date(event.started_at), timeZone);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(event);
    else groups.push({ key, items: [event] });
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <section key={group.key}>
          <h3 className="mb-1 text-[0.75rem] font-medium text-faint">
            {dayHeading(group.key, todayKey)}
          </h3>
          <ol className="relative space-y-0.5">
            <span
              aria-hidden
              className="absolute top-3 bottom-3 end-[1.375rem] w-px bg-subtle"
            />
            {group.items.map((event) => (
              <Row
                key={event.id}
                event={event}
                memberNames={memberNames}
                onOpen={onOpen}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function Row({
  event,
  memberNames,
  onOpen,
}: {
  event: EventRow;
  memberNames: Record<string, string>;
  onOpen: (e: EventRow) => void;
}) {
  const meta = EVENT_META[event.type];
  const colors = FAMILY_CLASSES[meta.family];
  const summary = summarizeEvent(event.type, event.data);
  const pending = isPending(event.id);
  const duration =
    event.ended_at &&
    durationHebrew(
      (new Date(event.ended_at).getTime() - new Date(event.started_at).getTime()) / 1000,
    );

  return (
    <li>
      <button
        onClick={() => onOpen(event)}
        className={[
          "flex w-full items-start gap-3 rounded-md px-1 py-2 text-start",
          "transition-colors duration-150 active:bg-surface-sunken",
          pending ? "opacity-55" : "",
        ].join(" ")}
      >
        <div className="order-2 min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[0.9375rem] font-medium text-strong">
              {meta.label}
            </span>
            {duration ? (
              <span className="tnum text-[0.8125rem] text-muted">{duration}</span>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.8125rem] text-muted">
            <span className="tnum">{formatClock(new Date(event.started_at))}</span>
            {summary ? (
              <>
                <span className="text-faint">·</span>
                <span>{summary}</span>
              </>
            ) : null}
            {memberNames[event.created_by] ? (
              <>
                <span className="text-faint">·</span>
                <span className="text-faint">{memberNames[event.created_by]}</span>
              </>
            ) : null}
            {pending ? (
              <>
                <span className="text-faint">·</span>
                <span className="text-faint">נשמר…</span>
              </>
            ) : null}
          </div>
          {event.note ? (
            <p className="mt-1 line-clamp-2 text-[0.8125rem] text-default">
              {event.note}
            </p>
          ) : null}
          {event.photo_path ? (
            <Photo
              path={event.photo_path}
              alt={`תמונה מתוך ${meta.label}`}
              className="mt-2 h-24 w-full max-w-48 rounded-md"
            />
          ) : null}
        </div>

        <span
          className={`order-3 grid size-9 shrink-0 place-items-center rounded-full ${colors.soft} ${colors.text} ring-4 ring-[var(--surface-base)]`}
        >
          <EventIcon type={event.type} />
        </span>
      </button>
    </li>
  );
}

function DetailSheet({
  event,
  memberNames,
  canDelete,
  canEdit,
  onClose,
  onEdit,
  onDelete,
}: {
  event: EventRow;
  memberNames: Record<string, string>;
  canDelete: boolean;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const now = useNow();
  const meta = EVENT_META[event.type];
  const summary = summarizeEvent(event.type, event.data);

  const rows: { label: string; value: string }[] = [
    { label: "שעה", value: formatClock(new Date(event.started_at)) },
  ];

  if (now) {
    rows.push({ label: "לפני כמה זמן", value: relativeHebrew(event.started_at, now) });
  }
  if (event.ended_at) {
    rows.push({
      label: "משך",
      value: durationHebrew(
        (new Date(event.ended_at).getTime() - new Date(event.started_at).getTime()) /
          1000,
      ),
    });
  }
  if (summary) rows.push({ label: "פרטים", value: summary });
  if (memberNames[event.created_by]) {
    rows.push({ label: "נרשם על ידי", value: memberNames[event.created_by] });
  }

  return (
    <Sheet title={meta.label} onClose={onClose}>
      <dl className="divide-y divide-subtle">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4 py-2.5">
            <dt className="text-[0.875rem] text-muted">{r.label}</dt>
            <dd className="text-[0.9375rem] text-strong">{r.value}</dd>
          </div>
        ))}
      </dl>

      {event.note ? (
        <p className="mt-3 rounded-md bg-surface-sunken px-3 py-2.5 text-[0.9375rem] leading-relaxed text-default">
          {event.note}
        </p>
      ) : null}

      {event.photo_path ? (
        <Photo
          path={event.photo_path}
          alt={`תמונה מתוך ${meta.label}`}
          className="mt-3 max-h-[50dvh] w-full rounded-lg"
        />
      ) : null}

      {canEdit ? (
        <Button variant="primary" fullWidth className="mt-5" onClick={onEdit}>
          עריכה
        </Button>
      ) : null}

      {canDelete ? (
        <div className="mt-2">
          {confirming ? (
            <div className="flex flex-col gap-2">
              <p className="text-center text-[0.875rem] text-muted">
                למחוק את הרישום הזה?
              </p>
              <div className="flex gap-2">
                <Button variant="danger" fullWidth onClick={onDelete}>
                  כן, למחוק
                </Button>
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  ביטול
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" fullWidth onClick={() => setConfirming(true)}>
              מחיקת הרישום
            </Button>
          )}
        </div>
      ) : null}
    </Sheet>
  );
}
