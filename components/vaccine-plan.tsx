"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { PhotoField } from "@/components/photo";
import { deleteEvent, logEvent } from "@/lib/data/log";
import { deletePhotoQuietly } from "@/lib/photos";
import {
  extraVaccines,
  infancyDoses,
  nextVisit,
  vaccineItems,
  FLU_NOTE,
  type VaccineDose,
  type VaccineItem,
  type VaccineState,
} from "@/lib/vaccines";
import { longDate } from "@/lib/zoned";
import type { EventRow } from "@/types/db";

/**
 * לוח החיסונים.
 *
 * שתי שאלות, ושתיהן על אותו מסך: מה היא כבר קיבלה, ומה מחכה. הראשונה
 * נשאלת בחדר של האחות, השנייה בבית.
 *
 * הלוח עצמו סטטי ומגיע ממשרד הבריאות, אבל **הרישום הוא שקובע**: אפשר
 * לרשום מנה בכל תאריך, גם מוקדם וגם מאוחר מהגיל שבלוח, ואפשר למחוק
 * רישום שנעשה בטעות. בלי זה היינו מציגים לוח שמתווכח עם הפנקס.
 *
 * כל רישום נשמר כאירוע רגיל מסוג "חיסון", ולכן הוא מופיע גם ביומן וגם
 * בסיכום לרופא בלי שום עבודה נוספת.
 */

const STATE_STYLE: Record<VaccineState, { dot: string; row: string }> = {
  given: { dot: "bg-ok", row: "border-ok/25 bg-ok-soft/40" },
  skipped: { dot: "bg-line", row: "border-subtle bg-surface-sunken" },
  overdue: { dot: "bg-late", row: "border-late/30 bg-late-soft" },
  due: { dot: "bg-due", row: "border-due/30 bg-due-soft" },
  upcoming: { dot: "bg-line", row: "border-subtle bg-surface-card" },
};

const STATE_LABEL: Record<VaccineState, string> = {
  given: "ניתן",
  skipped: "לא ניתן",
  overdue: "באיחור",
  due: "עכשיו",
  upcoming: "בהמשך",
};

export function VaccinePlan({
  babyId,
  familyId,
  birthDate,
  currentUserId,
  events,
  canEdit,
}: {
  babyId: string;
  familyId: string;
  birthDate: string;
  currentUserId: string;
  /** כל אירועי החיסון של התינוק/ת, מהחדש לישן */
  events: EventRow[];
  /** צופה בלבד רואה את הלוח אבל לא רושם */
  canEdit: boolean;
}) {
  const router = useRouter();
  const [logging, setLogging] = useState<VaccineDose | null>(null);
  const [custom, setCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = vaccineItems(birthDate, events);
  const extras = extraVaccines(events);
  const visit = nextVisit(items);

  const infancy = items.filter((i) => i.dose.ageMonths !== null);
  const school = items.filter((i) => i.dose.ageMonths === null);

  // קיבוץ לפי גיל — ככה טיפת חלב מזמנת, ביקור אחד לכמה חיסונים
  const groups: { label: string; dueOn: string | null; items: VaccineItem[] }[] = [];
  for (const item of infancy) {
    const last = groups[groups.length - 1];
    if (last && last.label === item.dose.ageLabel) last.items.push(item);
    else groups.push({ label: item.dose.ageLabel, dueOn: item.dueOn, items: [item] });
  }

  // רק חיסוני הינקות נספרים — חיסוני בית הספר הם בעוד שש שנים
  const infancy2 = infancyDoses(items);
  const givenCount = infancy2.filter((i) => i.state === "given").length;

  /** מסמן שהחיסון לא יינתן, כדי שיפסיק להתריע. אירוע רגיל, אפשר לבטל. */
  async function skip(dose: VaccineDose) {
    setError(null);
    try {
      await logEvent(
        {
          babyId,
          type: "vaccine",
          startedAt: new Date(),
          data: { vaccine_id: dose.id, name: dose.name, skipped: true },
        },
        currentUserId,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "השמירה נכשלה");
    }
  }

  async function remove(item: VaccineItem) {
    if (!item.givenEventId) return;
    setError(null);

    try {
      const event = events.find((e) => e.id === item.givenEventId);
      await deleteEvent(item.givenEventId);
      if (event?.photo_path) deletePhotoQuietly(event.photo_path);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "המחיקה נכשלה");
    }
  }

  return (
    <>
      {visit ? (
        <div className="mb-4 rounded-lg border border-subtle bg-surface-card p-3.5">
          <p className="text-[0.8125rem] text-muted">הביקור הבא בטיפת חלב</p>
          <p className="tnum mt-0.5 text-[1.0625rem] font-semibold text-strong">
            {visit.ageLabel} · {longDate(visit.dueOn)}
          </p>
          <p className="mt-1 text-[0.8125rem] text-muted">
            {visit.doses.map((d) => d.name).join(" · ")}
          </p>
        </div>
      ) : null}

      <p className="mb-4 text-[0.8125rem] leading-relaxed text-muted">
        ניתנו {givenCount} מתוך {infancy2.length} חיסוני השגרה של השנה וחצי
        הראשונות. הלוח לקוח מטבלת
        חיסוני השגרה של משרד הבריאות — מה שקובע הוא הפנקס ומה שאומרת האחות,
        ואפשר לרשום כל מנה בתאריך שבו ניתנה בפועל.
      </p>

      {error ? (
        <p role="alert" className="mb-3 text-[0.8125rem] text-late">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <section key={group.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <h2 className="text-[0.9375rem] font-semibold text-strong">
                {group.label}
              </h2>
              {group.dueOn ? (
                <span className="tnum text-[0.75rem] text-faint">
                  {longDate(group.dueOn)}
                </span>
              ) : null}
            </div>

            <ul className="flex flex-col gap-1.5">
              {group.items.map((item) => (
                <Row
                  key={item.dose.id}
                  item={item}
                  canEdit={canEdit}
                  onLog={() => setLogging(item.dose)}
                  onSkip={() => skip(item.dose)}
                  onRemove={() => remove(item)}
                />
              ))}
            </ul>
          </section>
        ))}

        <section>
          <h2 className="mb-1.5 text-[0.9375rem] font-semibold text-strong">
            בגיל בית הספר
          </h2>
          <ul className="flex flex-col gap-1.5">
            {school.map((item) => (
              <Row
                key={item.dose.id}
                item={item}
                canEdit={canEdit}
                onLog={() => setLogging(item.dose)}
                onSkip={() => skip(item.dose)}
                onRemove={() => remove(item)}
              />
            ))}
          </ul>
          <p className="mt-2 text-[0.75rem] leading-relaxed text-faint">{FLU_NOTE}</p>
        </section>

        <section>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <h2 className="text-[0.9375rem] font-semibold text-strong">
              חיסונים נוספים
            </h2>
            {canEdit ? (
              <button
                onClick={() => setCustom(true)}
                className="text-[0.8125rem] text-accent-text underline-offset-2 hover:underline"
              >
                הוספה
              </button>
            ) : null}
          </div>

          {extras.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-5 text-center text-[0.8125rem] leading-relaxed text-muted">
              שפעת, מנינגוקוק B, קורונה — כל מה שאינו בלוח השגרה.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {extras.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-subtle bg-surface-card px-3.5 py-2.5"
                >
                  <span className="text-[0.9375rem] text-strong">{e.name}</span>
                  <span className="tnum text-[0.8125rem] text-muted">
                    {longDate(e.at.slice(0, 10))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {logging ? (
        <LogSheet
          babyId={babyId}
          familyId={familyId}
          currentUserId={currentUserId}
          dose={logging}
          onClose={() => setLogging(null)}
          onSaved={() => {
            setLogging(null);
            router.refresh();
          }}
          onError={setError}
        />
      ) : null}

      {custom ? (
        <LogSheet
          babyId={babyId}
          familyId={familyId}
          currentUserId={currentUserId}
          dose={null}
          onClose={() => setCustom(false)}
          onSaved={() => {
            setCustom(false);
            router.refresh();
          }}
          onError={setError}
        />
      ) : null}
    </>
  );
}

function Row({
  item,
  canEdit,
  onLog,
  onSkip,
  onRemove,
}: {
  item: VaccineItem;
  canEdit: boolean;
  onLog: () => void;
  onSkip: () => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const style = STATE_STYLE[item.state];

  return (
    <li className={`rounded-lg border px-3.5 py-2.5 ${style.row}`}>
      <div className="flex items-start gap-2.5">
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${style.dot}`} aria-hidden />

        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-medium text-strong">
            {item.dose.name}
            {item.dose.of > 1 ? (
              <span className="tnum font-normal text-muted">
                {" "}
                · מנה {item.dose.dose} מתוך {item.dose.of}
              </span>
            ) : null}
          </p>
          <p className="text-[0.75rem] leading-relaxed text-muted">
            {item.dose.protects}
          </p>
          {item.dose.note ? (
            <p className="mt-0.5 text-[0.75rem] leading-relaxed text-faint">
              {item.dose.note}
            </p>
          ) : null}
          {item.givenAt ? (
            <p className="tnum mt-1 text-[0.75rem] text-ok">
              ניתן ב-{longDate(item.givenAt.slice(0, 10))}
            </p>
          ) : null}
        </div>

        <span className="shrink-0 text-[0.75rem] text-muted">
          {STATE_LABEL[item.state]}
        </span>
      </div>

      {/* פעולות בטקסט ולא בכפתורים מלאים: יש כאן עשרים ושתיים שורות,
          ועשרים ושניים כפתורים היו הופכים את הדף לקיר */}
      {canEdit ? (
        <div className="mt-1.5 flex justify-end gap-3">
          {item.state === "given" || item.state === "skipped" ? (
            confirming ? (
              <>
                <button
                  onClick={onRemove}
                  className="min-h-tap text-[0.8125rem] text-late underline underline-offset-2"
                >
                  כן, לבטל
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="min-h-tap text-[0.8125rem] text-muted"
                >
                  השארה
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="min-h-tap text-[0.8125rem] text-muted underline underline-offset-2"
              >
                ביטול הרישום
              </button>
            )
          ) : (
            <>
              {/* "לא ניתן" קיים כדי שחיסון שלא יינתן יפסיק להתריע.
                  בלעדיו RSV שלא ניתן היה נשאר אדום לנצח */}
              <button
                onClick={onSkip}
                className="min-h-tap text-[0.8125rem] text-muted"
              >
                לא ניתן
              </button>
              <button
                onClick={onLog}
                className="min-h-tap text-[0.8125rem] font-medium text-accent-text underline underline-offset-2"
              >
                רישום שניתן
              </button>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}

/**
 * רישום מנה.
 *
 * התאריך ברירת מחדל הוא היום, אבל כמעט תמיד רושמים בדיעבד — ולכן הוא
 * שדה ראשון ולא מוסתר. התמונה כאן היא המדבקה מהפנקס, וזו הסיבה
 * האמיתית שהיא קיימת: פנקס אובד, התמונה לא.
 */
function LogSheet({
  babyId,
  familyId,
  currentUserId,
  dose,
  onClose,
  onSaved,
  onError,
}: {
  babyId: string;
  familyId: string;
  currentUserId: string;
  /** null = חיסון שאינו בלוח */
  dose: VaccineDose | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const today = new Date();
  const [date, setDate] = useState(
    new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10),
  );
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const label = dose ? dose.name : name.trim();

  async function save() {
    if (!label) return;
    setSaving(true);

    try {
      await logEvent(
        {
          babyId,
          type: "vaccine",
          // שעה 12:00 מקומית ולא חצות: רישום בדיעבד לא אמור ליפול על
          // גבול היום ולהופיע ביומן של אתמול
          startedAt: new Date(`${date}T12:00:00`),
          data: dose
            ? { vaccine_id: dose.id, name: dose.name, dose: dose.dose, of: dose.of }
            : { name: label },
          note,
          photoPath,
        },
        currentUserId,
      );
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "השמירה נכשלה");
      setSaving(false);
    }
  }

  return (
    <Sheet title={dose ? `רישום ${dose.name}` : "חיסון נוסף"} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {dose ? (
          <p className="text-[0.875rem] leading-relaxed text-muted">
            {dose.protects}
            {dose.of > 1 ? ` · מנה ${dose.dose} מתוך ${dose.of}` : ""}
          </p>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium text-default">שם החיסון</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שפעת, מנינגוקוק B…"
              className="min-h-tap-comfy rounded-md border border-line bg-surface-sunken px-3 text-[1rem] text-strong placeholder:text-faint"
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[0.875rem] font-medium text-default">מתי ניתן</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-tap rounded-md border border-line bg-surface-sunken px-3 text-[1rem] text-default"
          />
        </label>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="תגובה, חום, הערה (לא חובה)"
          className="rounded-md border border-line bg-surface-sunken px-3 py-2.5 text-[1rem] text-strong placeholder:text-faint"
        />

        <PhotoField
          familyId={familyId}
          babyId={babyId}
          value={photoPath}
          onChange={setPhotoPath}
        />
        <p className="-mt-1 text-[0.75rem] text-faint">
          שווה לצלם את המדבקה מהפנקס — פנקס אובד, התמונה נשארת.
        </p>

        <Button type="submit" fullWidth loading={saving} disabled={!label}>
          שמירה
        </Button>
      </form>
    </Sheet>
  );
}
