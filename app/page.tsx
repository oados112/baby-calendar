import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { isSupabaseConfigured } from "@/lib/config";
import { DEMO_MEMBER_NAMES, getDemoBaby, getDemoWeek } from "@/lib/demo-data";
import {
  getActiveTimers,
  getEventsPage,
  getFamilyContext,
  getHomeSnapshot,
  getMemberNames,
  getSelectedBaby,
  getSelectedBabyId,
} from "@/lib/data/family";
import { pickBaby } from "@/lib/babies";

const PAGE_SIZE = 40;

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

  const selectedId = await getSelectedBabyId();

  // מסלול מהיר: פנייה אחת שמחזירה את הכל. אם הפונקציה עדיין לא קיימת
  // במסד (המיגרציה טרם רצה), נופלים חזרה למסלול הישן — האתר לא נשבר.
  const snapshot = await getHomeSnapshot(selectedId, PAGE_SIZE + 1);

  if (snapshot) {
    const baby = pickBaby(snapshot.babies, snapshot.babyId ?? undefined);
    if (!baby) redirect("/onboarding");

    const hasMore = snapshot.events.length > PAGE_SIZE;

    return (
      <Dashboard
        baby={baby}
        events={hasMore ? snapshot.events.slice(0, PAGE_SIZE) : snapshot.events}
        timers={snapshot.timers}
        memberNames={snapshot.memberNames}
        currentUserId={snapshot.member.user_id}
        timeZone={snapshot.timeZone}
        siblings={snapshot.babies}
        hasMore={hasMore}
      />
    );
  }

  const context = await getFamilyContext();
  if (!context) redirect("/onboarding");

  const baby = await getSelectedBaby(context.babies);
  if (!baby) redirect("/onboarding");

  const [page, timers, memberNames] = await Promise.all([
    // מבקשים אחד יותר מהעמוד, כדי לדעת אם יש עוד בלי שאילתת ספירה
    getEventsPage(baby.id, PAGE_SIZE + 1),
    getActiveTimers(baby.id),
    getMemberNames(context.member.family_id),
  ]);

  const hasMore = page.length > PAGE_SIZE;

  return (
    <Dashboard
      baby={baby}
      events={hasMore ? page.slice(0, PAGE_SIZE) : page}
      timers={timers}
      memberNames={memberNames}
      currentUserId={context.member.user_id}
      timeZone={context.timeZone}
      siblings={context.babies}
      hasMore={hasMore}
    />
  );
}
