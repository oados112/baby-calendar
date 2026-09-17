"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { buildCsv, downloadCsv, fetchAllEvents } from "@/lib/export";

/**
 * ייצוא וגיבוי.
 *
 * שתי מטרות שונות שנפתרות באותו קובץ: להביא נתונים לרופא, ולהחזיק
 * עותק שלא תלוי בשום שירות. הקובץ יורד למכשיר ולא נשלח לשום מקום.
 */
export function ExportSettings({
  babyId,
  babyName,
  memberNames,
  timeZone,
}: {
  babyId: string;
  babyName: string;
  memberNames: Record<string, string>;
  timeZone: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function exportCsv() {
    setBusy(true);
    setMessage(null);

    try {
      const events = await fetchAllEvents(babyId);
      if (events.length === 0) {
        setMessage("אין עדיין רישומים לייצוא");
        return;
      }

      const csv = buildCsv(events, memberNames, timeZone);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(csv, `יומן-${babyName}-${stamp}.csv`);
      setMessage(`יוצאו ${events.length} רישומים`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "הייצוא נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-subtle bg-surface-card p-4">
      <h2 className="text-[0.9375rem] font-semibold text-strong">ייצוא וגיבוי</h2>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
        כל הרישומים לקובץ אחד שנפתח באקסל. שימושי לביקור אצל הרופא, וגם
        כעותק גיבוי שלא תלוי בשום שירות.
      </p>

      <Button
        variant="secondary"
        fullWidth
        className="mt-3"
        loading={busy}
        onClick={exportCsv}
      >
        {busy ? "מייצא…" : "הורדת כל היומן (CSV)"}
      </Button>

      <p className="mt-3 text-[0.75rem] leading-relaxed text-faint">
        לדף מודפס: פתחו את מסך היומן ביום הרצוי והדפיסו מהדפדפן. העיצוב
        מותאם להדפסה ומשמיט את התפריטים.
      </p>

      {message ? (
        <p role="status" className="mt-2 text-[0.8125rem] text-muted">
          {message}
        </p>
      ) : null}
    </section>
  );
}
