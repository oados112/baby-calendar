import { redirect } from "next/navigation";
import { DoctorView } from "@/components/doctor-view";
import { isSupabaseConfigured } from "@/lib/config";
import {
  getEventsBetween,
  getFamilyContext,
  getSelectedBaby,
} from "@/lib/data/family";
import { buildMedicalSummary } from "@/lib/medical-summary";
import { babyDisplayName } from "@/lib/baby";
import { babyAgeHebrew } from "@/lib/time";
import { dayKey as toDayKey, dayRange, lastDayKeys } from "@/lib/zoned";

export const metadata = { title: "סיכום לרופא · היומן של התינוק" };

const ALLOWED_RANGES = [7, 14, 30];

export default async function DoctorPage({ searchParams }: PageProps<"/doctor">) {
  if (!isSupabaseConfigured) redirect("/");

  const context = await getFamilyContext();
  if (!context) redirect("/onboarding");
  const baby = await getSelectedBaby(context.babies);
  if (!baby) redirect("/onboarding");

  const params = await searchParams;
  const raw = Array.isArray(params.days) ? params.days[0] : params.days;
  const parsed = Number(raw);
  const dayCount = ALLOWED_RANGES.includes(parsed) ? parsed : 7;

  const timeZone = context.timeZone;
  const keys = lastDayKeys(toDayKey(new Date(), timeZone), dayCount);
  const { from } = dayRange(keys[0], timeZone);
  const { to } = dayRange(keys[keys.length - 1], timeZone);

  // חצי יום אחורה, כדי ששנת לילה שהתחילה לפני התקופה תיספר נכון
  const events = await getEventsBetween(
    baby.id,
    new Date(from.getTime() - 12 * 3600_000),
    to,
  );

  const summary = buildMedicalSummary(events, timeZone, dayCount);

  return (
    <DoctorView
      summary={summary}
      babyName={babyDisplayName(baby.name)}
      babyAge={babyAgeHebrew(baby.birth_date, baby.sex)}
      dayCount={dayCount}
    />
  );
}
