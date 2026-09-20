import { redirect } from "next/navigation";
import { DayView } from "@/components/day-view";
import { isSupabaseConfigured } from "@/lib/config";
import { DEMO_MEMBER_NAMES, getDemoWeek } from "@/lib/demo-data";
import {
  getEventsBetween,
  getFamilyContext,
  getSelectedBaby,
  getMemberNames,
} from "@/lib/data/family";
import { summarizeDays } from "@/lib/stats";
import { dayKey as toDayKey, dayRange } from "@/lib/zoned";

export const metadata = { title: "יומן · היומן של התינוק" };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function JournalPage({ searchParams }: PageProps<"/journal">) {
  const params = await searchParams;
  const raw = Array.isArray(params.date) ? params.date[0] : params.date;

  // מצב תצוגה — מאפשר לבחון את המסך בלי חשבון
  if (!isSupabaseConfigured) {
    const tz = "Asia/Jerusalem";
    const today = toDayKey(new Date(), tz);
    const key = raw && DATE_PATTERN.test(raw) ? raw : today;
    const { from, to } = dayRange(key, tz);
    const events = getDemoWeek().filter(
      (e) => e.started_at >= from.toISOString() && e.started_at < to.toISOString(),
    );
    return (
      <DayView
        dayKey={key}
        todayKey={today}
        summary={summarizeDays(events, [key], tz)[0]}
        events={events}
        memberNames={DEMO_MEMBER_NAMES}
        currentUserId="demo-user-1"
        familyId="demo-family"
      />
    );
  }

  const context = await getFamilyContext();
  if (!context) redirect("/onboarding");
  const baby = await getSelectedBaby(context.babies);
  if (!baby) redirect("/onboarding");

  const timeZone = context.timeZone;
  const todayKey = toDayKey(new Date(), timeZone);

  // פרמטר לא תקין לא שובר את הדף — פשוט מציגים את היום
  const key = raw && DATE_PATTERN.test(raw) ? raw : todayKey;

  const { from, to } = dayRange(key, timeZone);
  const [events, memberNames] = await Promise.all([
    getEventsBetween(baby.id, from, to),
    getMemberNames(context.member.family_id),
  ]);

  const [summary] = summarizeDays(events, [key], timeZone);

  return (
    <DayView
      dayKey={key}
      todayKey={todayKey}
      summary={summary}
      events={events}
      memberNames={memberNames}
      currentUserId={context.member.user_id}
      familyId={context.member.family_id}
    />
  );
}
