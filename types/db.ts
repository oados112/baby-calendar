/**
 * טיפוסי בסיס הנתונים.
 *
 * שימו לב: שורות הטבלה מוגדרות כ-`type` ולא כ-`interface` בכוונה.
 * supabase-js דורש שכל Row יתאים ל-Record<string, unknown>; interface לא
 * מספק אילוץ אינדקס ולכן כל השאילתות היו מתקפלות ל-never.
 *
 * זמני: נכתב ביד כדי שנוכל לעבוד לפני שהפרויקט ב-Supabase קיים.
 * ברגע שהפרויקט יוקם, הקובץ הזה ייווצר אוטומטית:
 *   npm run db:types
 * ואז אין לערוך אותו ידנית.
 */

export type MemberRole = "admin" | "logger" | "viewer";

export type EventType =
  | "feed_breast"
  | "feed_bottle"
  | "pump"
  | "solids"
  | "drink"
  | "diaper"
  | "sleep"
  | "temperature"
  | "medicine"
  | "vaccine"
  | "doctor"
  | "growth"
  | "activity"
  | "milestone"
  | "note";

export type ReminderKind =
  | "feed_gap"
  | "sleep_gap"
  | "diaper_gap"
  | "medicine"
  | "vitamin"
  | "vaccine_due"
  | "timer_running"
  | "daily_summary"
  | "partner_activity";

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export type FamilyRow = {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
}

export type FamilyMemberRow = {
  family_id: string;
  user_id: string;
  display_name: string;
  role: MemberRole;
  can_see_medical: boolean;
  is_suspended: boolean;
  joined_at: string;
}

export type BabyRow = {
  id: string;
  family_id: string;
  /** null בימים הראשונים, לפני שנבחר שם */
  name: string | null;
  birth_date: string;
  birth_time: string | null;
  sex: "male" | "female" | "unspecified" | null;
  photo_path: string | null;
  birth_weight_g: number | null;
  birth_height_cm: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export type EventRow = {
  id: string;
  baby_id: string;
  family_id: string;
  type: EventType;
  started_at: string;
  ended_at: string | null;
  data: Json;
  note: string | null;
  photo_path: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
}

export type ActiveTimerRow = {
  id: string;
  baby_id: string;
  family_id: string;
  type: EventType;
  side: "left" | "right" | null;
  left_sec: number;
  right_sec: number;
  started_at: string;
  segment_started_at: string;
  paused_at: string | null;
  started_by: string;
}

type TableDef<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      families: TableDef<FamilyRow>;
      family_members: TableDef<FamilyMemberRow>;
      babies: TableDef<BabyRow>;
      events: TableDef<
        EventRow,
        Pick<EventRow, "baby_id" | "type" | "started_at" | "created_by"> &
          Partial<EventRow>
      >;
      active_timers: TableDef<ActiveTimerRow>;
    };
    Views: { [_ in never]: never };
    Functions: {
      create_family_with_baby: {
        Args: {
          p_family_name: string;
          p_display_name: string;
          p_baby_name: string | null;
          p_birth_date: string;
          p_birth_time?: string | null;
          p_sex?: string;
          p_birth_weight_g?: number | null;
          p_timezone?: string;
        };
        Returns: { family_id: string; baby_id: string }[];
      };
      accept_invite: { Args: { p_token: string }; Returns: string };
      soft_delete_event: { Args: { p_event_id: string }; Returns: void };
      last_events_summary: {
        Args: { p_baby_id: string };
        Returns: Pick<
          EventRow,
          "type" | "started_at" | "ended_at" | "data" | "created_by"
        >[];
      };
    };
    Enums: {
      member_role: MemberRole;
      event_type: EventType;
      reminder_kind: ReminderKind;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
