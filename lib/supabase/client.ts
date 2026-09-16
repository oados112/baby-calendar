"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/db";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** לקוח Supabase לדפדפן. מופע יחיד — כדי לא לפתוח כמה חיבורי Realtime. */
export function getSupabaseBrowserClient() {
  if (!cached) {
    cached = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return cached;
}
