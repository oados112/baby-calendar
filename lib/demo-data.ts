import type { EventRow, EventType } from "@/types/db";

/**
 * נתוני דוגמה למצב תצוגה (כל עוד אין פרויקט Supabase).
 *
 * הזמנים מעוגנים לתחילת השעה הנוכחית ונבנים בכל רינדור מחדש.
 * חשוב שזו תהיה פונקציה ולא קבוע ברמת המודול: קבוע מחושב פעם אחת כשתהליך
 * השרת עולה ומתיישן מול הדפדפן — מה שמייצר אי-התאמה בהידרציה.
 */

interface DemoSpec {
  type: EventType;
  minutesAgo: number;
  data?: Record<string, unknown>;
  durationMin?: number;
  note?: string;
}

const SPECS: DemoSpec[] = [
  { type: "diaper", minutesAgo: 22, data: { pee: true, poo: false } },
  { type: "feed_bottle", minutesAgo: 95, data: { amount_ml: 120, kind: "formula" } },
  { type: "sleep", minutesAgo: 210, durationMin: 85 },
  {
    type: "diaper",
    minutesAgo: 230,
    data: { pee: true, poo: true, color: "yellow", texture: "seedy" },
  },
  {
    type: "feed_breast",
    minutesAgo: 285,
    data: { left_sec: 480, right_sec: 360, last_side: "right" },
    durationMin: 14,
  },
  {
    type: "activity",
    minutesAgo: 340,
    data: { kind: "tummy_time" },
    durationMin: 12,
    note: "החזיק את הראש הרבה יותר זמן",
  },
  { type: "sleep", minutesAgo: 420, durationMin: 140 },
  { type: "feed_bottle", minutesAgo: 575, data: { amount_ml: 110, kind: "expressed" } },
  { type: "diaper", minutesAgo: 600, data: { pee: true, poo: false } },
];

function topOfHour(): number {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

export function getDemoEvents(): EventRow[] {
  const base = topOfHour();
  const at = (m: number) => new Date(base - m * 60_000).toISOString();

  return SPECS.map((spec, i) => ({
    id: `demo-${i + 1}`,
    baby_id: "demo-baby",
    family_id: "demo-family",
    type: spec.type,
    started_at: at(spec.minutesAgo),
    ended_at: spec.durationMin ? at(spec.minutesAgo - spec.durationMin) : null,
    data: (spec.data ?? {}) as EventRow["data"],
    note: spec.note ?? null,
    photo_path: null,
    created_by: i % 3 === 2 ? "demo-user-2" : "demo-user-1",
    created_at: at(spec.minutesAgo),
    updated_at: at(spec.minutesAgo),
    updated_by: null,
    deleted_at: null,
  }));
}

export function getDemoBaby() {
  return {
    id: "demo-baby",
    name: null as string | null,
    birth_date: "2026-09-12",
    birth_time: "23:24",
    sex: "unspecified" as const,
    birth_weight_g: 2795,
  };
}

export const DEMO_MEMBER_NAMES: Record<string, string> = {
  "demo-user-1": "אוהד",
  "demo-user-2": "אשתי",
};
