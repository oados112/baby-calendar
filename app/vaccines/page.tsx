import { redirect } from "next/navigation";
import { PageNav } from "@/components/page-nav";
import { VaccinePlan } from "@/components/vaccine-plan";
import { isSupabaseConfigured } from "@/lib/config";
import {
  getFamilyContext,
  getSelectedBaby,
  getVaccineEvents,
} from "@/lib/data/family";

export const metadata = { title: "חיסונים · היומן של התינוק" };

export default async function VaccinesPage() {
  // מצב תצוגה — הלוח נשען על תאריך לידה אמיתי, אין מה להראות בלעדיו
  if (!isSupabaseConfigured) redirect("/");

  const context = await getFamilyContext();
  if (!context) redirect("/onboarding");
  const baby = await getSelectedBaby(context.babies);
  if (!baby) redirect("/onboarding");

  const events = await getVaccineEvents(baby.id);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col pt-[calc(1rem+var(--safe-top))]">
      <PageNav />

      <main id="main" className="flex-1 px-4 pb-10">
        <h1 className="mb-3 text-xl font-semibold tracking-tight text-strong">
          חיסונים
        </h1>

        <VaccinePlan
          babyId={baby.id}
          familyId={context.member.family_id}
          birthDate={baby.birth_date}
          currentUserId={context.member.user_id}
          events={events}
          canEdit={context.member.role !== "viewer"}
        />
      </main>
    </div>
  );
}
