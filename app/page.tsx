import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { isSupabaseConfigured } from "@/lib/config";
import { DEMO_MEMBER_NAMES, getDemoBaby, getDemoEvents } from "@/lib/demo-data";
import { getFamilyContext, getMemberNames, getRecentEvents } from "@/lib/data/family";

export default async function HomePage() {
  // מצב תצוגה: כל עוד אין Supabase מוגדר, מציגים נתוני דוגמה
  if (!isSupabaseConfigured) {
    return (
      <Dashboard
        baby={getDemoBaby()}
        events={getDemoEvents()}
        memberNames={DEMO_MEMBER_NAMES}
      />
    );
  }

  const context = await getFamilyContext();
  if (!context) redirect("/onboarding");

  const baby = context.babies[0];
  if (!baby) redirect("/onboarding");

  const [events, memberNames] = await Promise.all([
    getRecentEvents(baby.id),
    getMemberNames(context.member.family_id),
  ]);

  return <Dashboard baby={baby} events={events} memberNames={memberNames} />;
}
