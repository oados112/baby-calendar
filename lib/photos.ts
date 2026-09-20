"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * תמונות.
 *
 * שתי החלטות שמנחות את הקובץ הזה:
 *
 *  1. **דוחסים בדפדפן לפני ההעלאה.** תמונה מהטלפון היא 3–5MB; אחרי
 *     הקטנה ל-1600px והמרה ל-WebP היא בערך 200KB. זה חוסך זמן העלאה
 *     על חיבור סלולרי, ומחזיק אותנו הרבה מתחת לתקרת האחסון החינמית.
 *  2. **הדלי פרטי.** אין לתמונות כתובת ציבורית. כל צפייה מייצרת קישור
 *     חתום שתקף לשעה. תמונה של תינוק לא צריכה להיות נגישה למי שמנחש.
 */

const BUCKET = "baby-photos";
const MAX_EDGE = 1600;
const QUALITY = 0.82;

/** מקטין וממיר ל-WebP. נופל בחזרה לקובץ המקורי אם משהו לא נתמך. */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("אפשר להעלות רק תמונות");
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", QUALITY),
    );

    // אם הדחיסה לא הועילה, אין טעם להחליף את המקור
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

function extensionFor(blob: Blob): string {
  if (blob.type === "image/webp") return "webp";
  if (blob.type === "image/png") return "png";
  return "jpg";
}

/** מעלה בלוב מוכן (למשל פריים מהמצלמה) ומחזיר את הנתיב. */
export async function uploadBlob(
  blob: Blob,
  familyId: string,
  babyId: string,
): Promise<string> {
  if (blob.size > 5 * 1024 * 1024) {
    throw new Error("התמונה גדולה מדי");
  }

  // התיקייה הראשונה היא המשפחה — עליה נשענות ההרשאות בצד השרת
  const name = `${crypto.randomUUID()}.${extensionFor(blob)}`;
  const path = `${familyId}/${babyId}/${name}`;

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    upsert: false,
  });

  if (error) throw new Error(error.message);
  return path;
}

/** מקטין פריים גולמי מהמצלמה לאותן מידות כמו תמונה שנבחרה מהמכשיר. */
export async function frameToBlob(
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<Blob> {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("הדפדפן לא תומך בצילום");

  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", QUALITY),
  );

  if (!blob) throw new Error("הצילום נכשל");
  return blob;
}

/** מעלה ומחזיר את הנתיב שנשמר על האירוע. */
export async function uploadPhoto(
  file: File,
  familyId: string,
  babyId: string,
): Promise<string> {
  return uploadBlob(await compressImage(file), familyId, babyId);
}

/** מחיקה שלא מפילה כלום אם היא נכשלה — משמשת בניקוי אחרי מחיקת רישום. */
export async function deletePhotoQuietly(path: string): Promise<void> {
  try {
    await deletePhoto(path);
  } catch {
    // אין טעם להכשיל מחיקת רישום בגלל קובץ שנשאר מאחור
  }
}

/**
 * קישור חתום לצפייה.
 *
 * נשמר במטמון בזיכרון: אותה תמונה מופיעה גם ברשימה וגם בתצוגה המלאה,
 * ואין סיבה לבקש חתימה פעמיים.
 */
const signedCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_TTL_SECONDS = 3600;

export async function getPhotoUrl(path: string): Promise<string | null> {
  const cached = signedCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;

  signedCache.set(path, {
    url: data.signedUrl,
    // מפוגגים דקה מוקדם, כדי לא להגיש קישור שפג בדיוק בזמן הצפייה
    expiresAt: Date.now() + (SIGNED_TTL_SECONDS - 60) * 1000,
  });

  return data.signedUrl;
}

export async function deletePhoto(path: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(error.message);
  signedCache.delete(path);
}
