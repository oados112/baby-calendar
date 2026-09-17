/**
 * מייצר זוג מפתחות VAPID להתראות פוש.
 *
 * הרצה:  npm run push:keys
 *
 * המפתח הציבורי נכנס ל-NEXT_PUBLIC_VAPID_PUBLIC_KEY ומגיע לדפדפן.
 * המפתח הפרטי נכנס ל-VAPID_PRIVATE_KEY ונשאר בשרת בלבד.
 *
 * מריצים את זה פעם אחת. החלפת המפתחות בהמשך מנתקת את כל המנויים
 * הקיימים, וכל מכשיר יצטרך לאשר התראות מחדש.
 */

import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("\nהעתיקו לקובץ .env.local ולמשתני הסביבה ב-Vercel:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:oados112@gmail.com");
console.log(
  "\nהמפתח הפרטי הוא סוד — אל תכניסו אותו לקוד ואל תשתפו אותו.\n",
);
