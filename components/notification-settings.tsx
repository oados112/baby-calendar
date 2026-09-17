"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  disablePush,
  enablePush,
  isSubscribed,
  readPushSupport,
  readPushSupportOnServer,
  refreshPushSupport,
  subscribeToPushSupport,
} from "@/lib/push";
import type { ReminderRuleRow } from "@/types/db";

/**
 * הגדרות התראות.
 *
 * ההתראות כאן נועדו לעזור, לא להציק. הורה שמקבל התראה מיותרת בלילה
 * מכבה את הכל — ואז גם החשובות הולכות לאיבוד. לכן כל כלל ניתן לכיבוי
 * בנפרד, לכל כלל יש סף שאפשר לשנות, ויש שעות שקט.
 */

const KIND_LABELS: Record<string, { title: string; hint: string; unit?: string }> = {
  feed_gap: {
    title: "עבר זמן מההאכלה",
    hint: "לא מתריע בזמן שהתינוק/ת ישן/ה",
    unit: "שעות",
  },
  sleep_gap: {
    title: "ער/ה יותר מדי זמן",
    hint: "עוזר למנוע עייפות יתר",
    unit: "שעות",
  },
  diaper_gap: {
    title: "עבר זמן מהחיתול האחרון",
    hint: "כבוי כברירת מחדל",
    unit: "שעות",
  },
  timer_running: {
    title: "טיימר שנשכח דולק",
    hint: "כשטיימר רץ הרבה מעבר לרגיל",
    unit: "דקות",
  },
  daily_summary: {
    title: "תקציר יומי",
    hint: "סיכום קצר של היום בשעה קבועה",
  },
  partner_activity: {
    title: "פעילות של ההורה השני",
    hint: "כרגע לא פעיל — הרישומים מופיעים ממילא מיד במסך",
  },
};

export function NotificationSettings({
  userId,
  rules: initialRules,
}: {
  userId: string;
  rules: ReminderRuleRow[];
}) {
  // הרשאת ההתראות היא מצב של הדפדפן, ולכן נקראת ממנו ישירות
  const support = useSyncExternalStore(
    subscribeToPushSupport,
    readPushSupport,
    readPushSupportOnServer,
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rules, setRules] = useState(initialRules);

  useEffect(() => {
    isSubscribed().then(setSubscribed);
  }, []);

  async function toggleDevice() {
    setBusy(true);
    setMessage(null);

    if (subscribed) {
      await disablePush();
      setSubscribed(false);
      setMessage("ההתראות כובו במכשיר הזה");
    } else {
      const error = await enablePush(userId);
      if (error) {
        setMessage(error);
      } else {
        setSubscribed(true);
        refreshPushSupport();
        setMessage("המכשיר הזה יקבל התראות מעכשיו");
      }
    }

    setBusy(false);
  }

  async function patchRule(rule: ReminderRuleRow, patch: Partial<ReminderRuleRow>) {
    const before = rules;
    setRules((current) =>
      current.map((r) => (r.id === rule.id ? { ...r, ...patch } : r)),
    );

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("reminder_rules")
      .update(patch)
      .eq("id", rule.id);

    if (error) {
      setRules(before);
      setMessage(error.message);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-lg border border-subtle bg-surface-card p-4">
        <h2 className="text-[0.9375rem] font-semibold text-strong">
          התראות במכשיר הזה
        </h2>

        {support === "needs-install" ? (
          <div className="mt-2 rounded-md bg-due-soft px-3 py-2.5 text-[0.8125rem] leading-relaxed text-due">
            באייפון התראות עובדות רק כשהאתר מותקן במסך הבית. בספארי: לחצו על
            כפתור השיתוף, ואז <span className="font-semibold">הוספה למסך הבית</span>.
            פתחו את האתר משם וחזרו לכאן.
          </div>
        ) : support === "denied" ? (
          <div className="mt-2 rounded-md bg-late-soft px-3 py-2.5 text-[0.8125rem] leading-relaxed text-late">
            הדפדפן חוסם התראות לאתר הזה. צריך לאשר אותן ידנית בהגדרות
            האתר בדפדפן, ואז לחזור לכאן.
          </div>
        ) : support === "unsupported" ? (
          <p className="mt-2 text-[0.8125rem] text-muted">
            הדפדפן הזה לא תומך בהתראות. נסו מכרום באנדרואיד או מהמחשב.
          </p>
        ) : (
          <>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
              {subscribed
                ? "המכשיר הזה רשום. אפשר לכבות בכל רגע."
                : "כל מכשיר נרשם בנפרד — אפשר התראות בטלפון ולא במחשב."}
            </p>
            <Button
              variant={subscribed ? "secondary" : "primary"}
              fullWidth
              className="mt-3"
              loading={busy}
              onClick={toggleDevice}
            >
              {subscribed ? "כיבוי התראות במכשיר הזה" : "הפעלת התראות"}
            </Button>
          </>
        )}

        {message ? (
          <p role="status" className="mt-2 text-[0.8125rem] text-muted">
            {message}
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[0.9375rem] font-semibold text-strong">מה להתריע</h2>

        {rules.map((rule) => {
          const meta = KIND_LABELS[rule.kind];
          if (!meta) return null;

          const config = (rule.config ?? {}) as Record<string, unknown>;
          const amount =
            typeof config.hours === "number"
              ? config.hours
              : typeof config.minutes === "number"
                ? config.minutes
                : null;

          return (
            <div
              key={rule.id}
              className="rounded-lg border border-subtle bg-surface-card p-3.5"
            >
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={rule.is_enabled}
                  onChange={(e) =>
                    patchRule(rule, { is_enabled: e.target.checked })
                  }
                  className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
                />
                <span className="flex-1">
                  <span className="block text-[0.9375rem] font-medium text-strong">
                    {meta.title}
                  </span>
                  <span className="block text-[0.8125rem] text-muted">
                    {meta.hint}
                  </span>
                </span>
              </label>

              {rule.is_enabled && amount !== null && meta.unit ? (
                <div className="mt-3 flex items-center gap-3 ps-8">
                  <span className="text-[0.8125rem] text-muted">אחרי</span>
                  <input
                    type="number"
                    min={meta.unit === "שעות" ? 1 : 15}
                    max={meta.unit === "שעות" ? 12 : 600}
                    step={meta.unit === "שעות" ? 0.5 : 15}
                    value={amount}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      if (!Number.isFinite(next)) return;
                      patchRule(rule, {
                        config: (meta.unit === "שעות"
                          ? { ...config, hours: next }
                          : { ...config, minutes: next }) as ReminderRuleRow["config"],
                      });
                    }}
                    className="min-h-tap w-24 rounded-md border border-line bg-surface-sunken px-3 text-center text-[1rem] text-strong"
                  />
                  <span className="text-[0.8125rem] text-muted">{meta.unit}</span>
                </div>
              ) : null}

              {rule.is_enabled && rule.quiet_from && rule.quiet_to ? (
                <p className="mt-2 ps-8 text-[0.75rem] text-faint">
                  שקט בין {rule.quiet_from.slice(0, 5)} ל-{rule.quiet_to.slice(0, 5)}
                </p>
              ) : null}
            </div>
          );
        })}
      </section>
    </div>
  );
}
