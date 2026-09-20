"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui";
import { formatHours } from "@/lib/stats";
import { summaryAsText, type MedicalSummary } from "@/lib/medical-summary";
import { formatClock } from "@/lib/time";
import { longDate, shortDate, weekdayShort } from "@/lib/zoned";

/**
 * דף לרופא.
 *
 * מעוצב להיקרא בעשר שניות ולהידפס בדף אחד. אין כאן גרפים, אין צבעים
 * דקורטיביים, ואין שום פרשנות — רק המספרים שרופא שואל עליהם ממילא.
 *
 * הבחירה בין 7 ל-30 יום היא לא קישוט: ביקור שגרתי בטיפת חלב מסתכל על
 * חודש, ובירור של בעיה נקודתית מסתכל על השבוע.
 */
export function DoctorView({
  summary,
  babyName,
  babyAge,
  dayCount,
}: {
  summary: MedicalSummary;
  babyName: string;
  babyAge: string;
  dayCount: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        summaryAsText(summary, babyName, dayCount),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-[calc(1rem+var(--safe-top))] pb-10">
      <header className="mb-4">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-[1.0625rem] font-semibold text-strong">
            סיכום לרופא
          </h1>
          <Link
            href="/stats"
            className="text-[0.8125rem] text-accent-text underline-offset-2 hover:underline"
          >
            חזרה
          </Link>
        </div>
        <p className="mt-1 text-[0.8125rem] text-muted">
          {babyName} · {babyAge} · {dayCount} הימים האחרונים
        </p>
      </header>

      <nav aria-label="טווח" className="mb-4 flex gap-1.5">
        {[7, 14, 30].map((n) => (
          <Link
            key={n}
            href={`/doctor?days=${n}`}
            aria-current={n === dayCount ? "page" : undefined}
            className={[
              "flex min-h-tap flex-1 items-center justify-center rounded-md border text-[0.875rem]",
              n === dayCount
                ? "border-accent bg-accent-soft font-medium text-accent-text"
                : "border-line bg-surface-card text-default",
            ].join(" ")}
          >
            {n} ימים
          </Link>
        ))}
      </nav>

      <main id="main" className="flex flex-col gap-4">
        <Block title="ממוצעים יומיים">
          <Row label="האכלות" value={summary.avgFeeds.toFixed(1)} />
          {summary.avgBottleMl > 0 ? (
            <Row label="בקבוק" value={`${Math.round(summary.avgBottleMl)} מ״ל`} />
          ) : null}
          <Row label="שינה" value={formatHours(summary.avgSleepMinutes)} />
          <Row label="חיתולים" value={summary.avgDiapers.toFixed(1)} />
        </Block>

        <Block title="גדילה">
          {summary.growth.length === 0 ? (
            <Empty>לא נרשמו מדידות בתקופה</Empty>
          ) : (
            <>
              {summary.weightGainPerDay !== null ? (
                <Row
                  label="עלייה במשקל"
                  value={`${Math.round(summary.weightGainPerDay)} גרם ליום`}
                />
              ) : null}
              {summary.growth.map((g) => {
                const d = (g.data ?? {}) as Record<string, number | null>;
                const parts = [
                  d.weight_g ? `${(d.weight_g / 1000).toFixed(3)} ק״ג` : null,
                  d.height_cm ? `${d.height_cm} ס״מ` : null,
                  d.head_cm ? `היקף ${d.head_cm}` : null,
                ].filter(Boolean);
                return (
                  <Row
                    key={g.id}
                    label={shortDate(g.started_at.slice(0, 10))}
                    value={parts.join(" · ")}
                  />
                );
              })}
            </>
          )}
        </Block>

        <Block title="חום">
          {summary.temperatures.length === 0 ? (
            <Empty>לא נמדד חום בתקופה</Empty>
          ) : (
            summary.temperatures.slice(0, 10).map((t) => (
              <Row
                key={t.at}
                label={`${longDate(t.at.slice(0, 10))} ${formatClock(new Date(t.at))}`}
                value={`${t.celsius.toFixed(1)}°`}
                emphasis={t.celsius >= 38}
              />
            ))
          )}
        </Block>

        <Block title="תרופות">
          {summary.medicines.length === 0 ? (
            <Empty>לא ניתנו תרופות בתקופה</Empty>
          ) : (
            summary.medicines.map((m) => (
              <Row
                key={m.name}
                label={m.name}
                value={`${m.doses} מנות · אחרונה ${shortDate(m.lastAt.slice(0, 10))}`}
              />
            ))
          )}
        </Block>

        <Block title="פירוט יומי">
          <table className="w-full text-[0.8125rem]">
            <thead>
              <tr className="text-muted">
                <th className="py-1 text-start font-medium">יום</th>
                <th className="py-1 text-start font-medium">האכלות</th>
                <th className="py-1 text-start font-medium">שינה</th>
                <th className="py-1 text-start font-medium">חיתולים</th>
              </tr>
            </thead>
            <tbody>
              {[...summary.days].reverse().map((d) => (
                <tr key={d.key} className="border-t border-subtle">
                  <td className="py-1.5 text-default">
                    {weekdayShort(d.key)} {shortDate(d.key)}
                  </td>
                  <td className="tnum py-1.5 text-strong">{d.feeds || "—"}</td>
                  <td className="tnum py-1.5 text-strong">
                    {d.sleepMinutes ? formatHours(d.sleepMinutes) : "—"}
                  </td>
                  <td className="tnum py-1.5 text-strong">{d.diapers || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>

        {summary.notableNotes.length > 0 ? (
          <Block title="הערות שנרשמו">
            {summary.notableNotes.map((n) => (
              <p key={n.at} className="border-t border-subtle py-2 first:border-0">
                <span className="text-[0.75rem] text-muted">
                  {shortDate(n.at.slice(0, 10))} {formatClock(new Date(n.at))} ·{" "}
                  {n.type}
                </span>
                <span className="mt-0.5 block text-[0.875rem] text-default">
                  {n.text}
                </span>
              </p>
            ))}
          </Block>
        ) : null}

        <p className="text-[0.75rem] leading-relaxed text-faint">
          הנתונים הם מה שנרשם ביומן בלבד, ללא פרשנות. סך הכל{" "}
          {summary.totalEvents} רישומים בתקופה.
        </p>

        <div className="flex gap-2 print:hidden">
          <Button variant="secondary" fullWidth onClick={copy}>
            {copied ? "הועתק" : "העתקת סיכום כטקסט"}
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            הדפסה
          </Button>
        </div>
      </main>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-subtle bg-surface-card p-3.5">
      <h2 className="mb-1.5 text-[0.9375rem] font-semibold text-strong">{title}</h2>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-subtle py-1.5 first:border-0">
      <span className="text-[0.8125rem] text-muted">{label}</span>
      <span
        className={`tnum text-[0.9375rem] ${emphasis ? "font-semibold text-late" : "text-strong"}`}
      >
        {value}
      </span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-1 text-[0.8125rem] text-muted">{children}</p>;
}
