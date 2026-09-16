import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { isSupabaseConfigured } from "@/lib/config";
import { DEMO_MEMBER_NAMES, getDemoBaby, getDemoEvents } from "@/lib/demo-data";
import {
  getActiveTimers,
  getFamilyContext,
  getMemberNames,
  getRecentEvents,
} from "@/lib/data/family";

export default async function HomePage() {
  // מצב תצוגה: כל עוד אין Supabase מוגדר, מציגים נתוני דוגמה
  if (!isSupabaseConfigured) {
    return (
      <Dashboard
        baby={getDemoBaby()}
        events={getDemoEvents()}
        timers={[]}
        memberNames={DEMO_MEMBER_NAMES}
        demo
      />
    );
  }

  const context = await getFamilyContext();
  if (!context) redirect("/onboarding");

  const baby = context.babies[0];
  if (!baby) redirect("/onboarding");

  const [events, timers, memberNames] = await Promise.all([
    getRecentEvents(baby.id),
    getActiveTimers(baby.id),
    getMemberNames(context.member.family_id),
  ]);

  return (
    <Dashboard
      baby={baby}
      events={events}
      timers={timers}
      memberNames={memberNames}
      currentUserId={context.member.user_id}
    />
  );
}
