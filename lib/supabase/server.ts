import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/db";

/**
 * לקוח Supabase לצד השרת (Server Components, Route Handlers, Server Actions).
 * משתמש במפתח ה-anon — כלומר כפוף ל-RLS בדיוק כמו הדפדפן. זה מכוון.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // קריאה מ-Server Component: הרענון נעשה ב-middleware, אפשר להתעלם
          }
        },
      },
    },
  );
}
