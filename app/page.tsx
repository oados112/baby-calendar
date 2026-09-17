import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { isSupabaseConfigured } from "@/lib/config";
import { DEMO_MEMBER_NAMES, getDemoBaby, getDemoWeek } from "@/lib/demo-data";
import {
  getActiveTimers,
  getEventsPage,
  getFamilyContext,
  getMemberNames,
} from "@/lib/data/family";

export default async function HomePage() {
  // מצב תצוגה: כל עוד אין Supabase מוגדר, מציגים נתוני דוגמה
  if (!isSupabaseConfigured) {
    return (
      <Dashboard
        baby={getDemoBaby()}
        events={getDemoWeek()}
        timers={[]}
        memberNames={DEMO_MEMBER_NAMES}
        timeZone="Asia/Jerusalem"
        demo
      />
    );
  }

  const context = await getFamilyContext();
  if (!context) redirect("/onboarding");

  const baby = context.babies[0];
  if (!baby) redirect("/onboarding");

  const PAGE_SIZE = 40;
  const [page, timers, memberNames] = await Promise.all([
    // מבקשים אחד יותר מהעמוד, כדי לדעת אם יש עוד בלי שאילתת ספירה
    getEventsPage(baby.id, PAGE_SIZE + 1),
    getActiveTimers(baby.id),
    getMemberNames(context.member.family_id),
  ]);

  const hasMore = page.length > PAGE_SIZE;
  const events = hasMore ? page.slice(0, PAGE_SIZE) : page;

  return (
    <Dashboard
      baby={baby}
      events={events}
      timers={timers}
      memberNames={memberNames}
      currentUserId={context.member.user_id}
      timeZone={context.timeZone}
      hasMore={hasMore}
    />
  );
}
