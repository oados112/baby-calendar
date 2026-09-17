import { redirect } from "next/navigation";
import Link from "next/link";
import { NotificationSettings } from "@/components/notification-settings";
import { PageNav } from "@/components/page-nav";
import { isSupabaseConfigured } from "@/lib/config";
import { getFamilyContext } from "@/lib/data/family";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ReminderRuleRow } from "@/types/db";

export const metadata = { title: "הגדרות · היומן של התינוק" };

export default async function SettingsPage() {
  if (!isSupabaseConfigured) redirect("/");

  const context = await getFamilyContext();
  if (!context) redirect("/onboarding");

  const supabase = await getSupabaseServerClient();
  const { data: rules } = await supabase
    .from("reminder_rules")
    .select("*")
    .eq("family_id", context.member.family_id)
    .order("kind", { ascending: true });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col pt-[calc(1rem+var(--safe-top))]">
      <PageNav />

      <main id="main" className="flex-1 px-4 pb-10">
        <h1 className="mb-4 text-[1.0625rem] font-semibold text-strong">הגדרות</h1>

        <NotificationSettings
          userId={context.member.user_id}
          rules={(rules ?? []) as ReminderRuleRow[]}
        />

        <section className="mt-6 rounded-lg border border-subtle bg-surface-card p-4">
          <h2 className="text-[0.9375rem] font-semibold text-strong">המשפחה</h2>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
            מחוברים בתור {context.member.display_name}. ניהול בני משפחה
            והזמנות ייבנה בשלב הבא.
          </p>
          <Link
            href="/"
            className="mt-3 inline-block text-[0.875rem] text-accent-text underline-offset-2 hover:underline"
          >
            חזרה למסך הבית
          </Link>
        </section>
      </main>
    </div>
  );
}
