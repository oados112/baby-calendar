import type { EventType } from "@/types/db";

/**
 * מקור האמת היחיד לשם, לצבע ולקיבוץ של כל סוג אירוע.
 * כל מסך — מסך הבית, היומן, הגרפים — קורא מכאן, כדי שצבע "שינה"
 * יהיה אותו צבע בדיוק בכל מקום באתר.
 */

export type EventFamily =
  | "feed"
  | "sleep"
  | "diaper"
  | "health"
  | "growth"
  | "activity"
  | "note";

export interface EventMeta {
  /** שם בעברית, יחיד */
  label: string;
  /** לתיאור בעבר: "האכלה אחרונה" */
  lastLabel: string;
  family: EventFamily;
  /** האם לאירוע יש משך (טיימר) */
  hasDuration: boolean;
  /** מידע רפואי — מוגבל בהרשאות */
  medical: boolean;
}

export const EVENT_META: Record<EventType, EventMeta> = {
  feed_breast: {
    label: "הנקה",
    lastLabel: "הנקה אחרונה",
    family: "feed",
    hasDuration: true,
    medical: false,
  },
  feed_bottle: {
    label: "בקבוק",
    lastLabel: "בקבוק אחרון",
    family: "feed",
    hasDuration: false,
    medical: false,
  },
  pump: {
    label: "שאיבה",
    lastLabel: "שאיבה אחרונה",
    family: "feed",
    hasDuration: true,
    medical: false,
  },
  solids: {
    label: "מוצקים",
    lastLabel: "ארוחה אחרונה",
    family: "feed",
    hasDuration: false,
    medical: false,
  },
  drink: {
    label: "שתייה",
    lastLabel: "שתייה אחרונה",
    family: "feed",
    hasDuration: false,
    medical: false,
  },
  diaper: {
    label: "חיתול",
    lastLabel: "חיתול אחרון",
    family: "diaper",
    hasDuration: false,
    medical: false,
  },
  sleep: {
    label: "שינה",
    lastLabel: "שינה אחרונה",
    family: "sleep",
    hasDuration: true,
    medical: false,
  },
  temperature: {
    label: "חום",
    lastLabel: "מדידת חום אחרונה",
    family: "health",
    hasDuration: false,
    medical: true,
  },
  medicine: {
    label: "תרופה",
    lastLabel: "תרופה אחרונה",
    family: "health",
    hasDuration: false,
    medical: true,
  },
  vaccine: {
    label: "חיסון",
    lastLabel: "חיסון אחרון",
    family: "health",
    hasDuration: false,
    medical: true,
  },
  doctor: {
    label: "ביקור רופא",
    lastLabel: "ביקור אחרון",
    family: "health",
    hasDuration: false,
    medical: true,
  },
  growth: {
    label: "מדידה",
    lastLabel: "מדידה אחרונה",
    family: "growth",
    hasDuration: false,
    medical: false,
  },
  activity: {
    label: "פעילות",
    lastLabel: "פעילות אחרונה",
    family: "activity",
    hasDuration: true,
    medical: false,
  },
  milestone: {
    label: "אבן דרך",
    lastLabel: "אבן דרך אחרונה",
    family: "activity",
    hasDuration: false,
    medical: false,
  },
  note: {
    label: "הערה",
    lastLabel: "הערה אחרונה",
    family: "note",
    hasDuration: false,
    medical: false,
  },
};

/** מחלקות Tailwind לכל משפחת אירועים — טקסט, רקע רך וגבול. */
export const FAMILY_CLASSES: Record<
  EventFamily,
  { text: string; soft: string; border: string; dot: string }
> = {
  feed: {
    text: "text-feed",
    soft: "bg-feed-soft",
    border: "border-feed/25",
    dot: "bg-feed",
  },
  sleep: {
    text: "text-sleep",
    soft: "bg-sleep-soft",
    border: "border-sleep/25",
    dot: "bg-sleep",
  },
  diaper: {
    text: "text-diaper",
    soft: "bg-diaper-soft",
    border: "border-diaper/25",
    dot: "bg-diaper",
  },
  health: {
    text: "text-health",
    soft: "bg-health-soft",
    border: "border-health/25",
    dot: "bg-health",
  },
  growth: {
    text: "text-growth",
    soft: "bg-growth-soft",
    border: "border-growth/25",
    dot: "bg-growth",
  },
  activity: {
    text: "text-activity",
    soft: "bg-activity-soft",
    border: "border-activity/25",
    dot: "bg-activity",
  },
  note: {
    text: "text-note",
    soft: "bg-note-soft",
    border: "border-note/25",
    dot: "bg-note",
  },
};

/**
 * סיכום קריא בעברית של רישום, לפי הנתונים שלו.
 * לדוגמה: בקבוק 120 מ"ל · תמ"ל
 */
export function summarizeEvent(type: EventType, data: unknown): string | null {
  const d = (data ?? {}) as Record<string, unknown>;
  const num = (k: string) => (typeof d[k] === "number" ? (d[k] as number) : null);

  switch (type) {
    case "feed_bottle": {
      const ml = num("amount_ml");
      const kind =
        d.kind === "formula"
          ? "תמ״ל"
          : d.kind === "breast_milk"
            ? "חלב אם"
            : d.kind === "expressed"
              ? "חלב שאוב"
              : null;
      return [ml ? `${ml} מ״ל` : null, kind].filter(Boolean).join(" · ") || null;
    }
    case "feed_breast": {
      const l = num("left_sec") ?? 0;
      const r = num("right_sec") ?? 0;
      const parts: string[] = [];
      if (l) parts.push(`שמאל ${Math.round(l / 60)}′`);
      if (r) parts.push(`ימין ${Math.round(r / 60)}′`);
      return parts.join(" · ") || null;
    }
    case "diaper": {
      const parts: string[] = [];
      if (d.pee) parts.push("פיפי");
      if (d.poo) parts.push("קקי");
      if (!parts.length) parts.push("יבש");
      if (d.rash) parts.push("אדמומיות");
      return parts.join(" · ");
    }
    case "temperature": {
      const t = num("celsius");
      return t ? `${t.toFixed(1)}°` : null;
    }
    case "growth": {
      const parts: string[] = [];
      const w = num("weight_g");
      const h = num("height_cm");
      const hc = num("head_cm");
      if (w) parts.push(`${(w / 1000).toFixed(3)} ק״ג`);
      if (h) parts.push(`${h} ס״מ`);
      if (hc) parts.push(`היקף ראש ${hc}`);
      return parts.join(" · ") || null;
    }
    case "medicine": {
      const name = typeof d.name === "string" ? d.name : null;
      const dose = typeof d.dose === "string" ? d.dose : null;
      return [name, dose].filter(Boolean).join(" · ") || null;
    }
    default:
      return null;
  }
}
