
/**
 * לוח חיסוני השגרה בישראל.
 *
 * המקור: טבלת חיסוני השגרה של משרד הבריאות,
 * https://me.health.gov.il/parenting/raising-children/immunization-schedule/babies-immunization-schedule/
 * נקרא באוקטובר 2026.
 *
 * **הלוח כאן אינו סמכות רפואית.** הוא העתקה של הטבלה הרשמית כדי שתדעו
 * מה מתקרב, ותו לא. מה שנקבע בפועל הוא מה שכתוב בפנקס החיסונים ומה
 * שאומרת האחות — ולכן כל שורה כאן ניתנת לרישום בתאריך אחר מזה שהלוח
 * מציע, והרישום הוא שקובע.
 *
 * שימו לב: אתרי קופות החולים חלוקים בפרטים (למשל מתי ניתנת המנה
 * השנייה של MMRV ומתי המנה השנייה של צהבת A). הלכנו לפי משרד הבריאות,
 * שהוא המקור הרשמי, אבל זו בדיוק הסיבה להצליב מול הפנקס.
 */

/**
 * המינימום שצריך מאירוע כדי לשבץ אותו בלוח.
 *
 * מבנה ולא `EventRow`: אותה פונקציה רצה גם בדפדפן על שורות מלאות וגם
 * במנוע ההתראות על שאילתה מצומצמת, ואין סיבה שהמנוע ישלוף עמודות
 * שהוא לא צריך רק כדי לרצות את הטיפוס.
 */
export interface VaccineEventLike {
  id: string;
  type: string;
  started_at: string;
  data: unknown;
  deleted_at: string | null;
}

export interface VaccineDose {
  /** מזהה יציב — נשמר על האירוע ומקשר בין הלוח לרישום */
  id: string;
  /** שם מסחרי או שגור */
  name: string;
  /** מפני מה הוא מגן */
  protects: string;
  /** מספר המנה בסדרה, ומתוך כמה */
  dose: number;
  of: number;
  /** גיל במתן, בחודשים מהלידה. null = גיל בית ספר */
  ageMonths: number | null;
  /** תווית הגיל כפי שהיא מופיעה בלוח */
  ageLabel: string;
  /** הערה שחשוב שתופיע ליד השורה */
  note?: string;
}

/**
 * כל הלוח, מהלידה ועד כיתה ח׳.
 *
 * מנות של אותו חיסון נושאות את אותו `series`, כדי שאפשר יהיה להציג
 * "מנה 2 מתוך 4" ולדעת מה הבא בתור בסדרה.
 */
export const VACCINE_SCHEDULE: VaccineDose[] = [
  {
    id: "hepb-1",
    name: "צהבת B",
    protects: "דלקת כבד נגיפית B",
    dose: 1,
    of: 3,
    ageMonths: 0,
    ageLabel: "בלידה",
    note: "ניתן בבית החולים, בדרך כלל בשעות הראשונות",
  },
  {
    id: "rsv-1",
    name: "RSV",
    protects: "נגיף ה-RSV, גורם עיקרי לברונכיוליטיס",
    dose: 1,
    of: 1,
    ageMonths: 0,
    ageLabel: "בלידה",
    note: "לילודים בעונת ה-RSV, ספטמבר–מרץ. נוגדן ולא חיסון במובן הרגיל",
  },
  {
    id: "hepb-2",
    name: "צהבת B",
    protects: "דלקת כבד נגיפית B",
    dose: 2,
    of: 3,
    ageMonths: 1,
    ageLabel: "חודש",
  },
  {
    id: "penta-1",
    name: "מחומש",
    protects: "דיפתריה, טטנוס, שעלת, פוליו והמופילוס b",
    dose: 1,
    of: 4,
    ageMonths: 2,
    ageLabel: "חודשיים",
  },
  {
    id: "rota-1",
    name: "רוטה",
    protects: "נגיף הרוטה, גורם עיקרי לשלשול חריף",
    dose: 1,
    of: 3,
    ageMonths: 2,
    ageLabel: "חודשיים",
    note: "ניתן דרך הפה",
  },
  {
    id: "pcv-1",
    name: "פנאומוקוק",
    protects: "חיידק הפנאומוקוק — דלקת ריאות, אוזניים וקרום המוח",
    dose: 1,
    of: 3,
    ageMonths: 2,
    ageLabel: "חודשיים",
  },
  {
    id: "penta-2",
    name: "מחומש",
    protects: "דיפתריה, טטנוס, שעלת, פוליו והמופילוס b",
    dose: 2,
    of: 4,
    ageMonths: 4,
    ageLabel: "4 חודשים",
  },
  {
    id: "rota-2",
    name: "רוטה",
    protects: "נגיף הרוטה",
    dose: 2,
    of: 3,
    ageMonths: 4,
    ageLabel: "4 חודשים",
  },
  {
    id: "pcv-2",
    name: "פנאומוקוק",
    protects: "חיידק הפנאומוקוק",
    dose: 2,
    of: 3,
    ageMonths: 4,
    ageLabel: "4 חודשים",
  },
  {
    id: "penta-3",
    name: "מחומש",
    protects: "דיפתריה, טטנוס, שעלת, פוליו והמופילוס b",
    dose: 3,
    of: 4,
    ageMonths: 6,
    ageLabel: "6 חודשים",
  },
  {
    id: "rota-3",
    name: "רוטה",
    protects: "נגיף הרוטה",
    dose: 3,
    of: 3,
    ageMonths: 6,
    ageLabel: "6 חודשים",
  },
  {
    id: "hepb-3",
    name: "צהבת B",
    protects: "דלקת כבד נגיפית B",
    dose: 3,
    of: 3,
    ageMonths: 6,
    ageLabel: "6 חודשים",
  },
  {
    id: "penta-4",
    name: "מחומש",
    protects: "דיפתריה, טטנוס, שעלת, פוליו והמופילוס b",
    dose: 4,
    of: 4,
    ageMonths: 12,
    ageLabel: "שנה",
  },
  {
    id: "pcv-3",
    name: "פנאומוקוק",
    protects: "חיידק הפנאומוקוק",
    dose: 3,
    of: 3,
    ageMonths: 12,
    ageLabel: "שנה",
  },
  {
    id: "mmrv-1",
    name: "MMRV",
    protects: "חצבת, חזרת, אדמת ואבעבועות רוח",
    dose: 1,
    of: 2,
    ageMonths: 12,
    ageLabel: "שנה",
  },
  {
    id: "hepa-1",
    name: "צהבת A",
    protects: "דלקת כבד נגיפית A",
    dose: 1,
    of: 2,
    ageMonths: 18,
    ageLabel: "שנה וחצי",
  },
  {
    id: "mmrv-2",
    name: "MMRV",
    protects: "חצבת, חזרת, אדמת ואבעבועות רוח",
    dose: 2,
    of: 2,
    ageMonths: 18,
    ageLabel: "שנה וחצי",
  },
  {
    id: "hepa-2",
    name: "צהבת A",
    protects: "דלקת כבד נגיפית A",
    dose: 2,
    of: 2,
    ageMonths: null,
    ageLabel: "כיתה א׳",
  },
  {
    id: "school-dtap-ipv",
    name: "דיפתריה-טטנוס-שעלת-פוליו",
    protects: "דיפתריה, טטנוס, שעלת ופוליו",
    dose: 1,
    of: 1,
    ageMonths: null,
    ageLabel: "כיתה ב׳",
  },
  {
    id: "school-hpv-1",
    name: "HPV",
    protects: "נגיף הפפילומה, הגורם לסרטן צוואר הרחם",
    dose: 1,
    of: 2,
    ageMonths: null,
    ageLabel: "כיתה ז׳",
  },
  {
    id: "school-dtap",
    name: "דיפתריה-טטנוס-שעלת",
    protects: "דיפתריה, טטנוס ושעלת",
    dose: 1,
    of: 1,
    ageMonths: null,
    ageLabel: "כיתה ח׳",
  },
  {
    id: "school-hpv-2",
    name: "HPV",
    protects: "נגיף הפפילומה",
    dose: 2,
    of: 2,
    ageMonths: null,
    ageLabel: "כיתה ח׳",
  },
];

/** חיסון השפעת חוזר כל שנה ולכן אינו שורה בלוח. */
export const FLU_NOTE =
  "חיסון השפעת ניתן מדי שנה מגיל חצי שנה, ולכן אינו מופיע כשורה בלוח.";

export type VaccineState = "given" | "skipped" | "overdue" | "due" | "upcoming";

export interface VaccineItem {
  dose: VaccineDose;
  state: VaccineState;
  /** התאריך שהלוח מציע. null לגילאי בית ספר */
  dueOn: string | null;
  /** הרישום בפועל, אם ניתן */
  givenAt: string | null;
  givenEventId: string | null;
}

/**
 * חלון של שבועיים סביב התאריך המתוכנן.
 *
 * טיפת חלב לא מזמנת ליום המדויק, והורה שרואה "באיחור" יומיים אחרי
 * הגיל המתוכנן מקבל חרדה על לא כלום.
 */
const GRACE_DAYS = 14;

function addMonths(birthDate: string, months: number): string {
  const [y, m, d] = birthDate.slice(0, 10).split("-").map(Number);
  // יום שלא קיים בחודש היעד נדחף לסופו, לא לחודש הבא
  const lastDay = new Date(Date.UTC(y, m + months, 0)).getUTCDate();
  const shifted = new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay)));
  return shifted.toISOString().slice(0, 10);
}

/**
 * מצב כל שורה בלוח עבור תינוק נתון.
 *
 * "ניתן" נקבע לפי `data.vaccine_id` על אירוע מסוג `vaccine`. חיסון
 * שנרשם ידנית בלי מזהה — כזה שאינו בלוח, כמו שפעת — לא משויך לשום
 * שורה, וזו ההתנהגות הנכונה: הוא מופיע ברשימת "חיסונים נוספים".
 */
export function vaccineItems(
  birthDate: string,
  events: VaccineEventLike[],
  now: Date = new Date(),
): VaccineItem[] {
  const givenById = new Map<
    string,
    { at: string; id: string; skipped: boolean }
  >();

  for (const e of events) {
    if (e.type !== "vaccine" || e.deleted_at) continue;
    const data = e.data as Record<string, unknown> | null;
    const id = data?.vaccine_id;
    if (typeof id !== "string") continue;

    const current = givenById.get(id);
    // אם נרשם פעמיים, הראשון הוא הנכון — השני כנראה כפילות
    if (!current || e.started_at < current.at) {
      givenById.set(id, {
        at: e.started_at,
        id: e.id,
        skipped: data?.skipped === true,
      });
    }
  }

  const today = now.toISOString().slice(0, 10);

  return VACCINE_SCHEDULE.map((dose) => {
    const given = givenById.get(dose.id) ?? null;
    const dueOn = dose.ageMonths === null ? null : addMonths(birthDate, dose.ageMonths);

    let state: VaccineState = "upcoming";
    if (given) state = given.skipped ? "skipped" : "given";
    else if (dueOn) {
      const grace = new Date(
        new Date(`${dueOn}T00:00:00Z`).getTime() + GRACE_DAYS * 86_400_000,
      )
        .toISOString()
        .slice(0, 10);

      if (today > grace) state = "overdue";
      else if (today >= dueOn) state = "due";
    }

    return {
      dose,
      state,
      dueOn,
      givenAt: given && !given.skipped ? given.at : null,
      givenEventId: given?.id ?? null,
    };
  });
}

/**
 * רק חיסוני הינקות, 0–18 חודשים.
 *
 * הספירה "ניתנו X מתוך Y" נשענת על אלה בלבד: חיסוני בית הספר הם בעוד
 * שש שנים, ולספור אותם במכנה הופך את המספר לחסר משמעות.
 */
export function infancyDoses(items: VaccineItem[]): VaccineItem[] {
  return items.filter((i) => i.dose.ageMonths !== null);
}

/** חיסונים שנרשמו ואינם חלק מהלוח — שפעת, מנינגוקוק, קורונה. */
export function extraVaccines(
  events: VaccineEventLike[],
): { id: string; at: string; name: string }[] {
  const known = new Set(VACCINE_SCHEDULE.map((d) => d.id));

  return events
    .filter((e) => e.type === "vaccine" && !e.deleted_at)
    .filter((e) => {
      const id = (e.data as Record<string, unknown> | null)?.vaccine_id;
      return typeof id !== "string" || !known.has(id);
    })
    .map((e) => ({
      id: e.id,
      at: e.started_at,
      name:
        typeof (e.data as Record<string, unknown> | null)?.name === "string"
          ? ((e.data as Record<string, string>).name as string)
          : "חיסון",
    }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** מה שצריך לקרות עכשיו — לכרטיס במסך הבית ולהתראה. */
export function pendingVaccines(items: VaccineItem[]): VaccineItem[] {
  return items.filter((i) => i.state === "overdue" || i.state === "due");
}

/** הביקור הבא שעוד לא הגיע, עם כל מה שניתן בו. */
export function nextVisit(
  items: VaccineItem[],
): { dueOn: string; ageLabel: string; doses: VaccineDose[] } | null {
  const upcoming = items
    .filter((i) => i.state === "upcoming" && i.dueOn)
    .sort((a, b) => a.dueOn!.localeCompare(b.dueOn!));

  const first = upcoming[0];
  if (!first) return null;

  return {
    dueOn: first.dueOn!,
    ageLabel: first.dose.ageLabel,
    doses: upcoming.filter((i) => i.dueOn === first.dueOn).map((i) => i.dose),
  };
}
