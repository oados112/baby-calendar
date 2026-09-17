/**
 * מכין את כל הסודות להתראות — בלי להדפיס אותם למסך.
 *
 * הרצה:  node scripts/setup-secrets.mjs
 *
 * מה הוא עושה:
 *  1. מייצר זוג מפתחות VAPID חדש וסוד cron אקראי
 *  2. מעדכן את .env.local (משמר ערכים קיימים)
 *  3. כותב SETUP-SECRETS.txt עם מה שצריך להעתיק ל-Vercel ול-Supabase
 *
 * שני הקבצים מוחרגים מ-git. הסודות לא עוברים דרך הטרמינל ולא דרך הצ'אט —
 * פותחים את הקובץ ומעתיקים ממנו ישירות.
 */

import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import webpush from "web-push";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");
const outPath = join(root, "SETUP-SECRETS.txt");

const SITE_URL = "https://baby-calendar-eta.vercel.app";

const vapid = webpush.generateVAPIDKeys();
// 48 בייטים = 64 תווי base64url. יותר מספיק כדי שלא ינוחש.
const cronSecret = randomBytes(48).toString("base64url");

/** קורא את .env.local הקיים לתוך מפה, כדי לא לדרוס ערכים אחרים. */
function readEnv() {
  const map = new Map();
  if (!existsSync(envPath)) return map;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return map;
}

const env = readEnv();
env.set("NEXT_PUBLIC_VAPID_PUBLIC_KEY", vapid.publicKey);
env.set("VAPID_PRIVATE_KEY", vapid.privateKey);
env.set("VAPID_SUBJECT", "mailto:oados112@gmail.com");
env.set("CRON_SECRET", cronSecret);
if (!env.has("NEXT_PUBLIC_SITE_URL")) {
  env.set("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
}

const envBody =
  "# קובץ מקומי בלבד — לא נכנס ל-git (מוגדר ב-.gitignore)\n\n" +
  [...env].map(([k, v]) => `${k}=${v}`).join("\n") +
  "\n";

writeFileSync(envPath, envBody, "utf8");

const instructions = `הסודות של ההתראות
==================================================================
הקובץ הזה מוחרג מ-git. אחרי שתסיים להעתיק ממנו אפשר למחוק אותו.
אל תדביק את התוכן שלו בצ'אט.


שלב א — Vercel
------------------------------------------------------------------
Settings -> Environment Variables -> Add New, ארבע פעמים.
סמן את שלוש הסביבות (Production / Preview / Development).

NEXT_PUBLIC_VAPID_PUBLIC_KEY
${vapid.publicKey}

VAPID_PRIVATE_KEY
${vapid.privateKey}

VAPID_SUBJECT
mailto:oados112@gmail.com

CRON_SECRET
${cronSecret}

ואז: Deployments -> הפריסה העליונה -> Redeploy.


שלב ב — Supabase (SQL Editor)
------------------------------------------------------------------
קודם הרץ את הקובץ:
supabase/migrations/0008_reminders_cron.sql

ואז הרץ את הבלוק הזה בדיוק כמו שהוא:

insert into app_config (key, value) values
  ('site_url',    '${SITE_URL}'),
  ('cron_secret', '${cronSecret}')
on conflict (key) do update
  set value = excluded.value, updated_at = now();


שלב ג — הפעלה באתר
------------------------------------------------------------------
היכנס לאתר -> לשונית "הגדרות" -> "הפעלת התראות" -> אשר בדפדפן.
באייפון: קודם "הוסף למסך הבית", ורק משם להפעיל.
`;

writeFileSync(outPath, instructions, "utf8");

console.log("נכתבו שני קבצים:");
console.log("  .env.local          — עודכן עם המפתחות החדשים");
console.log("  SETUP-SECRETS.txt   — מה להעתיק ל-Vercel ול-Supabase");
console.log("\nשניהם מוחרגים מ-git. הסודות לא הודפסו למסך.");
