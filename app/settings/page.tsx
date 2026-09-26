import { redirect } from "next/navigation";
import Link from "next/link";
import { BabySettings } from "@/components/baby-settings";
import { FamilySettings, type CodeRow } from "@/components/family-settings";
import { ExportSettings } from "@/components/export-settings";
import { MedicationSettings } from "@/components/medication-settings";
import { NotificationSettings } from "@/components/notification-settings";
import { PageNav } from "@/components/page-nav";
import { isSupabaseConfigured } from "@/lib/config";
import {
  getFamilyContext,
  getMedicationPlans,
  getMemberNames,
} from "@/lib/data/family";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ReminderRuleRow } from "@/types/db";

export const metadata = { title: "הגדרות · היומן של התינוק" };

export default async function SettingsPage() {
  if (!isSupabaseConfigured) redirect("/");

  const context = await getFamilyContext();
  if (!context) redirect("/onboarding");

  const baby = context.babies[0] ?? null;

  const supabase = await getSupabaseServerClient();
  const isAdmin = context.member.role === "admin";

  const [{ data: rules }, { data: codes }, memberNames, plans] = await Promise.all([
    supabase
      .from("reminder_rules")
      .select("*")
      .eq("family_id", context.member.family_id)
      .order("kind", { ascending: true }),
    // רק מנהל רשאי, והפונקציה עצמה אוכפת את זה שוב
    isAdmin
      ? supabase.rpc("list_access_codes", {})
      : Promise.resolve({ data: [] as CodeRow[] }),
    getMemberNames(context.member.family_id),
    baby ? getMedicationPlans(baby.id) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col pt-[calc(1rem+var(--safe-top))]">
      <PageNav />

      <main id="main" className="flex-1 px-4 pb-10">
        <h1 className="mb-4 text-[1.0625rem] font-semibold text-strong">הגדרות</h1>

        <div className="flex flex-col gap-6">
          {baby ? <BabySettings baby={baby} /> : null}

          {baby ? <MedicationSettings babyId={baby.id} plans={plans} /> : null}

          <NotificationSettings
            userId={context.member.user_id}
            rules={(rules ?? []) as ReminderRuleRow[]}
          />

          {baby ? (
            <ExportSettings
              babyId={baby.id}
              babyName={baby.name?.trim() || "התינוק"}
              memberNames={memberNames}
              timeZone={context.timeZone}
            />
          ) : null}

          {isAdmin ? (
            <FamilySettings
              codes={(codes ?? []) as CodeRow[]}
              currentUserId={context.member.user_id}
            />
          ) : null}

          <Link
            href="/"
            className="text-center text-[0.875rem] text-accent-text underline-offset-2 hover:underline"
          >
            חזרה למסך הבית
          </Link>
        </div>
      </main>
    </div>
  );
}
