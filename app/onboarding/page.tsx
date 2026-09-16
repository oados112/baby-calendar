import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getFamilyContext } from "@/lib/data/family";

export const metadata = { title: "הקמה · היומן של התינוק" };

export default async function OnboardingPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // מי שכבר שייך למשפחה לא צריך להקים אחת
  const context = await getFamilyContext();
  if (context) redirect("/");

  const suggested = user.email ? user.email.split("@")[0] : "";

  return <OnboardingForm defaultDisplayName={suggested} />;
}
