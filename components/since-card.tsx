"use client";

import { relativeHebrew, secondsSince } from "@/lib/time";
import { FAMILY_CLASSES, type EventFamily } from "@/lib/event-meta";
import { useNow } from "@/lib/use-now";

type Status = "ok" | "due" | "late" | "none";

export interface SinceCardProps {
  title: string;
  /** מתי היה בפעם האחרונה. null = טרם נרשם */
  lastAt: string | null;
  family: EventFamily;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** אחרי כמה שעות זה הופך ל"מתקרב" ול"באיחור" */
  dueAfterHours?: number;
  lateAfterHours?: number;
  /** שורת פירוט קצרה: "120 מ״ל" */
  detail?: string | null;
  /** מחליף את המספר בטקסט קבוע, למשל כשטיימר רץ כרגע */
  overrideText?: string;
  onClick?: () => void;
}

function statusOf(
  seconds: number | null,
  dueAfterHours?: number,
  lateAfterHours?: number,
): Status {
  if (seconds === null) return "none";
  if (lateAfterHours && seconds >= lateAfterHours * 3600) return "late";
  if (dueAfterHours && seconds >= dueAfterHours * 3600) return "due";
  return "ok";
}

/**
 * זמן קומפקטי לכרטיס צר: מספר גדול + יחידה קטנה.
 * פחות משעה → "22 דק׳". מעל שעה → "3:35 שע׳".
 */
function compactSince(seconds: number): { value: string; unit: string } {
  if (seconds < 60) return { value: "עכשיו", unit: "" };
  if (seconds < 3600) return { value: String(Math.round(seconds / 60)), unit: "דק׳" };
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h < 24) return { value: `${h}:${String(m).padStart(2, "0")}`, unit: "שע׳" };
  return { value: String(Math.floor(h / 24)), unit: "ימים" };
}

const STATUS_TEXT: Record<Status, string> = {
  ok: "text-ok",
  due: "text-due",
  late: "text-late",
  none: "text-faint",
};

/**
 * כרטיס "כמה זמן עבר מאז".
 *
 * טבעת ההתקדמות עוטפת את האייקון עצמו — חוסכת רוחב בכרטיס צר ומחברת
 * ויזואלית את הסטטוס לסוג האירוע. המספר הגדול הוא הזמן שעבר, לא השעה,
 * כי זו השאלה האמיתית של הורה בשלוש לפנות בוקר.
 */
export function SinceCard({
  title,
  lastAt,
  family,
  icon: Icon,
  dueAfterHours,
  lateAfterHours,
  detail,
  overrideText,
  onClick,
}: SinceCardProps) {
  const now = useNow();
  const seconds = lastAt && now ? secondsSince(lastAt, now) : null;
  const status = statusOf(seconds, dueAfterHours, lateAfterHours);
  const colors = FAMILY_CLASSES[family];

  const target = (lateAfterHours ?? dueAfterHours ?? 4) * 3600;
  const progress = seconds === null ? 0 : Math.min(1, seconds / target);

  const R = 21;
  const C = 2 * Math.PI * R;
  const compact = seconds === null ? null : compactSince(seconds);

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      className={[
        "flex w-full flex-col items-center gap-1.5 rounded-lg border px-2 py-3",
        "border-subtle bg-surface-card shadow-[var(--shadow-sm)]",
        onClick ? "transition-transform duration-150 active:scale-[0.97]" : "",
      ].join(" ")}
      aria-label={
        overrideText
          ? `${title}, ${overrideText}`
          : lastAt && now
            ? `${title}, ${relativeHebrew(lastAt, now)}`
            : `${title}, טרם נרשם`
      }
    >
      {/* אייקון עטוף בטבעת התקדמות */}
      <span className="relative grid size-12 shrink-0 place-items-center">
        <svg
          viewBox="0 0 48 48"
          className={`absolute inset-0 size-12 -rotate-90 ${STATUS_TEXT[status]}`}
          aria-hidden
        >
          <circle
            cx="24"
            cy="24"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            opacity="0.16"
          />
          <circle
            cx="24"
            cy="24"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            style={{
              transition: "stroke-dashoffset var(--dur-slow) var(--ease-out)",
            }}
          />
        </svg>
        <span
          className={`grid size-8 place-items-center rounded-full ${colors.soft} ${colors.text}`}
        >
          <Icon className="size-4.5" />
        </span>
      </span>

      <span className="text-[0.75rem] font-medium text-muted">{title}</span>

      <span className="flex items-baseline gap-1" suppressHydrationWarning>
        {overrideText ? (
          <span className="text-[1rem] leading-none font-semibold text-accent-text">
            {overrideText}
          </span>
        ) : compact ? (
          <>
            <span className="tnum text-[1.25rem] leading-none font-semibold text-strong">
              {compact.value}
            </span>
            {compact.unit ? (
              <span className="text-[0.6875rem] text-muted">{compact.unit}</span>
            ) : null}
          </>
        ) : (
          <span className="text-[0.9375rem] leading-none text-faint">
            {lastAt === null ? "—" : "·"}
          </span>
        )}
      </span>

      {detail ? (
        <span className="line-clamp-1 max-w-full text-[0.6875rem] text-muted">
          {detail}
        </span>
      ) : (
        <span className="text-[0.6875rem] text-transparent select-none">·</span>
      )}
    </Wrapper>
  );
}
