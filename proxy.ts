import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";

/**
 * נתיבים שאינם דורשים סשן מחובר.
 *
 * שניים מהם הם נקודות קצה ולא מסכים, ולכל אחד יש שכבת הגנה משלו:
 *   /api/auth — מסלול הכניסה עצמו. חסימתו מנעה מכל אחד להתחבר.
 *   /api/cron — מנוע התזכורות, שנקרא מ-Supabase ולא מדפדפן. הוא מוגן
 *               בסוד משותף בכותרת. בלי החרגה כאן הוא קיבל הפניה
 *               ל-/login ומעולם לא רץ — וזו הסיבה שההתראות לא הגיעו.
 */
const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/api/auth",
  "/api/cron",
  "/invite",
  "/offline",
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // מצב תצוגה: כל עוד אין פרויקט Supabase, אין מה לאמת מולו
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims מאמת את חתימת הטוקן מקומית (מול מפתח ציבורי במטמון) ומרענן
  // אותו כשצריך. getUser, שהיה כאן קודם, פנה לשרת האימות בכל בקשה —
  // נסיעת רשת שהתווספה לכל ניווט ולכל טעינת נכס.
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims?.sub ? { id: claims.claims.sub } : null;

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // חזרה לאן שרצה להגיע, אחרי ההתחברות
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // כל הנתיבים חוץ מקבצים סטטיים, אייקונים ו-service worker
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)",
  ],
};
