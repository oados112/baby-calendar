import { redirect } from "next/navigation";
import { WeekView } from "@/components/week-view";
import { isSupabaseConfigured } from "@/lib/config";
import { getDemoWeek } from "@/lib/demo-data";
import {
  getEventsBetween,
  getFamilyContext,
  getGrowthEvents,
} from "@/lib/data/family";
import { sleepHeatmap, summarizeDays } from "@/lib/stats";
import { dayKey as toDayKey, dayRange, lastDayKeys } from "@/lib/zoned";

export const metadata = { title: "מגמות · היומן של התינוק" };

export default async function StatsPage() {
  // מצב תצוגה — מאפשר לבחון את המסך בלי חשבון
  if (!isSupabaseConfigured) {
    const tz = "Asia/Jerusalem";
    const today = toDayKey(new Date(), tz);
    const keys = lastDayKeys(today, 7);
    const events = getDemoWeek();
    return (
      <WeekView
        days={summarizeDays(events, keys, tz)}
        heatmap={sleepHeatmap(events, keys, tz)}
        todayKey={today}
        growth={[]}
        birthWeightG={2795}
      />
    );
  }

  const context = await getFamilyContext();
  if (!context) redirect("/onboarding");
  const baby = context.babies[0];
  if (!baby) redirect("/onboarding");

  const timeZone = context.timeZone;
  const todayKey = toDayKey(new Date(), timeZone);
  const keys = lastDayKeys(todayKey, 7);

  // מושכים יום נוסף אחורה: שינה שהתחילה אתמול בלילה שייכת גם לשעות של היום
  const { from } = dayRange(keys[0], timeZone);
  const { to } = dayRange(todayKey, timeZone);
  const [events, growth] = await Promise.all([
    getEventsBetween(baby.id, new Date(from.getTime() - 12 * 3600_000), to),
    // מדידות גדילה נשלפות לכל הזמנים, לא רק לשבוע האחרון
    getGrowthEvents(baby.id),
  ]);

  const days = summarizeDays(events, keys, timeZone);
  const heatmap = sleepHeatmap(events, keys, timeZone);

  return (
    <WeekView
      days={days}
      heatmap={heatmap}
      todayKey={todayKey}
      growth={growth}
      birthWeightG={baby.birth_weight_g}
    />
  );
}
