import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { zonedParts } from "@/lib/zoned";
import { durationHebrew } from "@/lib/time";

/**
 * מנוע התזכורות.
 *
 * רץ כל כמה דקות ושואל שאלה אחת לכל כלל: "האם עכשיו יש משהו שההורים
 * צריכים לדעת?". הוא לא מחזיק מצב משלו — הכל נגזר מהאירועים ומהטיימרים
 * שכבר קיימים, ולכן אין מה שיכול "להיתקע" או להתיישן.
 *
 * שלושה עקרונות שמנחים אותו:
 *
 *  1. **שקט עדיף על רעש.** הורה שמקבל התראה מיותרת בשלוש לפנות בוקר
 *     יכבה את ההתראות לגמרי, ואז גם החשובות ילכו לאיבוד. לכן: שעות
 *     שקט, מניעת כפילויות, ורק כללים שההורים הפעילו במפורש.
 *  2. **לא מתריעים על מה שכבר ברור.** אם התינוק ישן עכשיו, אין טעם
 *     להתריע שעבר זמן מההאכלה האחרונה.
 *  3. **התראה היא תזכורת, לא הוראה רפואית.** הנוסח נשאר עובדתי.
 */

export type ReminderKind =
  | "feed_gap"
  | "sleep_gap"
  | "diaper_gap"
  | "timer_running"
  | "daily_summary";

interface RuleRow {
  id: string;
  family_id: string;
  baby_id: string | null;
  target_user_id: string | null;
  kind: ReminderKind;
  config: Record<string, unknown>;
  is_enabled: boolean;
  quiet_from: string | null;
  quiet_to: string | null;
}

interface BabyRow {
  id: string;
  family_id: string;
  name: string | null;
}

interface EventLite {
  type: string;
  started_at: string;
  ended_at: string | null;
  data: Record<string, unknown> | null;
}

interface TimerLite {
  type: string;
  started_at: string;
}

export interface PreparedNotification {
  familyId: string;
  ruleId: string;
  targetUserId: string | null;
  dedupeKey: string;
  title: string;
  body: string;
  url: string;
  tag: string;
}

const MINUTE = 60_000;

function minutesSince(iso: string, now: number): number {
  return Math.max(0, (now - new Date(iso).getTime()) / MINUTE);
}

function numberConfig(config: Record<string, unknown>, key: string, fallback: number) {
  const value = config[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** "23:00"–"06:00" חוצה חצות, ולכן ההשוואה אינה פשוטה. */
export function inQuietHours(
  from: string | null,
  to: string | null,
  now: Date,
  timeZone: string,
): boolean {
  if (!from || !to) return false;

  const { hour, minute } = zonedParts(now, timeZone);
  const current = hour * 60 + minute;

  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const start = fh * 60 + fm;
  const end = th * 60 + tm;

  return start <= end ? current >= start && current < end : current >= start || current < end;
}

function babyLabel(baby: BabyRow): string {
  return baby.name?.trim() || "התינוק/ת";
}

/** האירוע האחרון מבין סוגים נתונים. */
function lastOf(events: EventLite[], types: string[]): EventLite | null {
  for (const e of events) {
    if (types.includes(e.type)) return e;
  }
  return null;
}

/**
 * מעריך את כל הכללים ומחזיר את ההתראות שצריך לשלוח.
 * פונקציה טהורה — אפשר לבדוק אותה בלי מסד נתונים ובלי רשת.
 */
export function evaluateRules({
  rules,
  baby,
  events,
  timers,
  timeZone,
  now,
}: {
  rules: RuleRow[];
  baby: BabyRow;
  /** ממוין מהחדש לישן */
  events: EventLite[];
  timers: TimerLite[];
  timeZone: string;
  now: Date;
}): PreparedNotification[] {
  const out: PreparedNotification[] = [];
  const nowMs = now.getTime();
  const name = babyLabel(baby);
  const sleeping = timers.some((t) => t.type === "sleep");

  for (const rule of rules) {
    if (!rule.is_enabled) continue;
    if (rule.kind !== "daily_summary" && inQuietHours(rule.quiet_from, rule.quiet_to, now, timeZone)) {
      continue;
    }

    const add = (n: Omit<PreparedNotification, "familyId" | "ruleId" | "targetUserId">) =>
      out.push({
        ...n,
        familyId: rule.family_id,
        ruleId: rule.id,
        targetUserId: rule.target_user_id,
      });

    switch (rule.kind) {
      case "feed_gap": {
        // תינוק שישן עכשיו אינו "מאחר" להאכלה — הוא ישן
        if (sleeping) break;

        const last = lastOf(events, ["feed_breast", "feed_bottle", "solids"]);
        if (!last) break;

        const hours = numberConfig(rule.config, "hours", 3);
        const elapsed = minutesSince(last.started_at, nowMs);
        if (elapsed < hours * 60) break;

        // מפתח שמשתנה עם ההאכלה ועם כל שעה נוספת: לא חוזר על עצמו כל
        // חמש דקות, אבל כן מזכיר שוב אם באמת ממשיך לעבור זמן
        const bucket = Math.floor(elapsed / 60);
        add({
          dedupeKey: `feed_gap:${baby.id}:${last.started_at}:${bucket}`,
          tag: `feed_gap:${baby.id}`,
          title: `${name} לא אכל/ה כבר ${durationHebrew(elapsed * 60)}`,
          body: "אולי הגיע הזמן להאכלה",
          url: "/",
        });
        break;
      }

      case "sleep_gap": {
        if (sleeping) break;

        const last = lastOf(events, ["sleep"]);
        const wokeAt = last?.ended_at ?? last?.started_at;
        if (!wokeAt) break;

        const hours = numberConfig(rule.config, "hours", 2);
        const elapsed = minutesSince(wokeAt, nowMs);
        if (elapsed < hours * 60) break;

        add({
          dedupeKey: `sleep_gap:${baby.id}:${wokeAt}:${Math.floor(elapsed / 60)}`,
          tag: `sleep_gap:${baby.id}`,
          title: `${name} ער/ה כבר ${durationHebrew(elapsed * 60)}`,
          body: "אולי הגיע הזמן לנמנום",
          url: "/",
        });
        break;
      }

      case "diaper_gap": {
        const last = lastOf(events, ["diaper"]);
        if (!last) break;

        const hours = numberConfig(rule.config, "hours", 4);
        const elapsed = minutesSince(last.started_at, nowMs);
        if (elapsed < hours * 60) break;

        add({
          dedupeKey: `diaper_gap:${baby.id}:${last.started_at}:${Math.floor(elapsed / 60)}`,
          tag: `diaper_gap:${baby.id}`,
          title: `לא נרשם חיתול כבר ${durationHebrew(elapsed * 60)}`,
          body: "שווה בדיקה",
          url: "/",
        });
        break;
      }

      case "timer_running": {
        const minutes = numberConfig(rule.config, "minutes", 150);

        for (const timer of timers) {
          const elapsed = minutesSince(timer.started_at, nowMs);
          if (elapsed < minutes) continue;

          const what = timer.type === "sleep" ? "טיימר השינה" : "טיימר ההנקה";
          add({
            dedupeKey: `timer_running:${baby.id}:${timer.type}:${timer.started_at}:${Math.floor(elapsed / 60)}`,
            tag: `timer_running:${baby.id}:${timer.type}`,
            title: `${what} רץ כבר ${durationHebrew(elapsed * 60)}`,
            body: "אם שכחתם לעצור אותו — אפשר לתקן את הזמן אחר כך",
            url: "/",
          });
        }
        break;
      }

      case "daily_summary": {
        const at = typeof rule.config.at === "string" ? rule.config.at : "21:00";
        const [h, m] = at.split(":").map(Number);
        const { hour, minute, year, month, day } = zonedParts(now, timeZone);

        // חלון של רבע שעה, כי ה-cron רץ כל כמה דקות ולא בדיוק בשעה העגולה
        const target = h * 60 + m;
        const current = hour * 60 + minute;
        if (current < target || current > target + 15) break;

        const dayStart = new Date(nowMs - 24 * 60 * MINUTE).toISOString();
        const today = events.filter((e) => e.started_at >= dayStart);

        const feeds = today.filter((e) =>
          ["feed_breast", "feed_bottle", "solids"].includes(e.type),
        ).length;
        const diapers = today.filter((e) => e.type === "diaper").length;
        const sleepMinutes = today
          .filter((e) => e.type === "sleep" && e.ended_at)
          .reduce(
            (sum, e) =>
              sum +
              (new Date(e.ended_at!).getTime() - new Date(e.started_at).getTime()) /
                MINUTE,
            0,
          );

        add({
          dedupeKey: `daily_summary:${baby.id}:${year}-${month}-${day}`,
          tag: `daily_summary:${baby.id}`,
          title: `הסיכום של ${name} להיום`,
          body: `${feeds} האכלות · ${durationHebrew(sleepMinutes * 60)} שינה · ${diapers} חיתולים`,
          url: "/journal",
        });
        break;
      }
    }
  }

  return out;
}

/**
 * מריץ מחזור אחד: קורא נתונים, מעריך כללים, ושולח.
 * מחזיר סיכום קצר לצורכי ניטור.
 */
export async function runReminderCycle(now = new Date()) {
  const admin = getSupabaseAdminClient();

  const [{ data: babies }, { data: rules }] = await Promise.all([
    admin.from("babies").select("id, family_id, name").eq("is_active", true),
    admin.from("reminder_rules").select("*").eq("is_enabled", true),
  ]);

  if (!babies?.length || !rules?.length) {
    return { babies: babies?.length ?? 0, prepared: 0, sent: 0 };
  }

  const { data: families } = await admin.from("families").select("id, timezone");
  const zoneOf = new Map(
    (families ?? []).map((f) => [f.id as string, (f.timezone as string) ?? "Asia/Jerusalem"]),
  );

  const prepared: PreparedNotification[] = [];

  for (const baby of babies as BabyRow[]) {
    const babyRules = (rules as RuleRow[]).filter(
      (r) => r.baby_id === baby.id || (r.baby_id === null && r.family_id === baby.family_id),
    );
    if (!babyRules.length) continue;

    const since = new Date(now.getTime() - 36 * 60 * MINUTE).toISOString();
    const [{ data: events }, { data: timers }] = await Promise.all([
      admin
        .from("events")
        .select("type, started_at, ended_at, data")
        .eq("baby_id", baby.id)
        .is("deleted_at", null)
        .gte("started_at", since)
        .order("started_at", { ascending: false }),
      admin.from("active_timers").select("type, started_at").eq("baby_id", baby.id),
    ]);

    prepared.push(
      ...evaluateRules({
        rules: babyRules,
        baby,
        events: (events ?? []) as EventLite[],
        timers: (timers ?? []) as TimerLite[],
        timeZone: zoneOf.get(baby.family_id) ?? "Asia/Jerusalem",
        now,
      }),
    );
  }

  const sent = await deliver(prepared, now);
  return { babies: babies.length, prepared: prepared.length, sent };
}

/** שולח את ההתראות שהוכנו, אחרי סינון כפילויות. */
async function deliver(items: PreparedNotification[], now: Date): Promise<number> {
  if (!items.length) return 0;

  const admin = getSupabaseAdminClient();
  const webpush = (await import("web-push")).default;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const familyIds = [...new Set(items.map((i) => i.familyId))];
  const { data: members } = await admin
    .from("family_members")
    .select("family_id, user_id")
    .in("family_id", familyIds)
    .eq("is_suspended", false);

  const userIds = [...new Set((members ?? []).map((m) => m.user_id as string))];
  if (!userIds.length) return 0;

  const [{ data: subs }, { data: recent }] = await Promise.all([
    admin.from("push_subscriptions").select("*").in("user_id", userIds),
    admin
      .from("notifications_log")
      .select("user_id, dedupe_key")
      .in("user_id", userIds)
      .gte("sent_at", new Date(now.getTime() - 24 * 60 * MINUTE).toISOString()),
  ]);

  const alreadySent = new Set(
    (recent ?? []).map((r) => `${r.user_id}:${r.dedupe_key}`),
  );

  let sent = 0;
  const logRows: Record<string, unknown>[] = [];

  for (const item of items) {
    const targets = (members ?? [])
      .filter((m) => m.family_id === item.familyId)
      .map((m) => m.user_id as string)
      .filter((id) => !item.targetUserId || id === item.targetUserId);

    for (const userId of targets) {
      if (alreadySent.has(`${userId}:${item.dedupeKey}`)) continue;
      alreadySent.add(`${userId}:${item.dedupeKey}`);

      const devices = (subs ?? []).filter((s) => s.user_id === userId);
      if (!devices.length) continue;

      const payload = JSON.stringify({
        title: item.title,
        body: item.body,
        url: item.url,
        tag: item.tag,
      });

      for (const device of devices) {
        try {
          await webpush.sendNotification(
            {
              endpoint: device.endpoint as string,
              keys: { p256dh: device.p256dh as string, auth: device.auth as string },
            },
            payload,
          );
          sent += 1;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // 404/410 = המנוי כבר לא קיים (האתר הוסר מהמכשיר, ההרשאה בוטלה)
          if (status === 404 || status === 410) {
            await admin.from("push_subscriptions").delete().eq("id", device.id);
          }
        }
      }

      logRows.push({
        user_id: userId,
        rule_id: item.ruleId,
        dedupe_key: item.dedupeKey,
        payload: { title: item.title, body: item.body },
      });
    }
  }

  if (logRows.length) {
    await admin.from("notifications_log").insert(logRows);
  }

  return sent;
}
