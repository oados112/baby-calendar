import { redirect } from "next/navigation";
import { PageNav } from "@/components/page-nav";
import { Gallery } from "@/components/gallery";
import { isSupabaseConfigured } from "@/lib/config";
import {
  getFamilyContext,
  getPhotoEvents,
  getSelectedBaby,
} from "@/lib/data/family";

export const metadata = { title: "תמונות · היומן של התינוק" };

export default async function GalleryPage() {
  // מצב תצוגה — נתוני הדוגמה לא נושאים תמונות, ולכן מוצג המסך הריק
  if (!isSupabaseConfigured) return <Shell items={[]} timeZone="Asia/Jerusalem" />;

  const context = await getFamilyContext();
  if (!context) redirect("/onboarding");
  const baby = await getSelectedBaby(context.babies);
  if (!baby) redirect("/onboarding");

  return <Shell items={await getPhotoEvents(baby.id)} timeZone={context.timeZone} />;
}

function Shell({
  items,
  timeZone,
}: {
  items: React.ComponentProps<typeof Gallery>["items"];
  timeZone: string;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col pt-[calc(1rem+var(--safe-top))]">
      <PageNav />

      <main id="main" className="flex-1 px-4 pb-10">
        <h1 className="mb-4 text-xl font-semibold tracking-tight text-strong">
          תמונות
        </h1>
        <Gallery items={items} timeZone={timeZone} />
      </main>
    </div>
  );
}
