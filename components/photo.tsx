"use client";

import { useEffect, useState } from "react";
import { getPhotoUrl, uploadPhoto } from "@/lib/photos";

/**
 * תמונות בממשק.
 *
 * הקישור לתמונה נוצר חתום ולזמן קצוב, ולכן הוא נטען בצד הלקוח ולא
 * מגיע מהשרת עם שאר הנתונים — כך אנחנו גם לא מייצרים חתימות לעשרות
 * תמונות שאף אחד לא יגלול אליהן.
 */

/** תמונה מנתיב מאוחסן. */
export function Photo({
  path,
  alt,
  className,
  onClick,
}: {
  path: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getPhotoUrl(path).then((next) => {
      if (!active) return;
      if (next) setUrl(next);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [path]);

  if (failed) {
    return (
      <div
        className={`grid place-items-center rounded-md bg-surface-sunken text-[0.6875rem] text-faint ${className ?? ""}`}
      >
        לא נטען
      </div>
    );
  }

  if (!url) {
    return (
      <div
        aria-hidden
        className={`animate-pulse rounded-md bg-surface-sunken ${className ?? ""}`}
      />
    );
  }

  const image = (
    // next/image לא מתאים כאן: הקישור חתום, זמני וייחודי לכל צפייה,
    // ואופטימיזציית תמונות ב-Vercel היא גם פיצ'ר בתשלום שהחלטנו לא לגעת בו
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`object-cover ${className ?? ""}`}
    />
  );

  if (!onClick) return image;

  return (
    <button onClick={onClick} className="block" aria-label={`הגדלת ${alt}`}>
      {image}
    </button>
  );
}

/**
 * בחירת תמונה בטופס.
 *
 * ההעלאה מתחילה מיד עם הבחירה ולא בשמירה — כך המשתמש רואה את התמונה
 * ומקבל שגיאה מוקדם, ולא אחרי שהוא כבר חשב שסיים.
 */
export function PhotoField({
  familyId,
  babyId,
  value,
  onChange,
}: {
  familyId: string;
  babyId: string;
  value: string | null;
  onChange: (path: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);

    try {
      onChange(await uploadPhoto(file, familyId, babyId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "ההעלאה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[0.875rem] font-medium text-default">תמונה</span>

      {value ? (
        <div className="flex items-center gap-3">
          <Photo path={value} alt="התמונה שנבחרה" className="size-20 rounded-md" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[0.875rem] text-muted underline-offset-2 hover:underline"
          >
            הסרה
          </button>
        </div>
      ) : (
        <label
          className={[
            "flex min-h-tap-comfy cursor-pointer items-center justify-center gap-2",
            "rounded-md border border-dashed border-line bg-surface-card",
            "text-[0.875rem] text-muted",
            busy ? "opacity-60" : "",
          ].join(" ")}
        >
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => pick(e.target.files?.[0])}
          />
          {busy ? "מעלה…" : "בחירת תמונה"}
        </label>
      )}

      {error ? (
        <p role="alert" className="text-[0.8125rem] text-late">
          {error}
        </p>
      ) : null}
    </div>
  );
}
