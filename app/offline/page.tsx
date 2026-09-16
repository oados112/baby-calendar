import { IconBaby } from "@/components/icons";

export const metadata = { title: "אין חיבור · היומן של התינוק" };

/**
 * הדף שמוצג כשאין רשת והדף המבוקש אינו במטמון.
 * מכוון להרגיע: שום רישום לא הולך לאיבוד, הוא רק ממתין.
 */
export default function OfflinePage() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-6 text-center"
    >
      <span className="mb-4 grid size-16 place-items-center rounded-full bg-surface-sunken text-muted">
        <IconBaby className="size-8" />
      </span>
      <h1 className="text-xl font-semibold text-strong">אין כרגע חיבור</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
        הרישומים שביצעתם נשמרו ויסונכרנו לבד ברגע שהחיבור יחזור.
      </p>
      <p className="mt-6 text-[0.8125rem] text-faint">
        אפשר לנסות לרענן את הדף.
      </p>
    </main>
  );
}
