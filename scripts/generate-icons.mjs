/**
 * מייצר את אייקוני האתר מ-SVG אחד.
 *
 * הרצה: npm run icons
 * המקור הוא הקוד כאן — אין קובץ תמונה ידני שאפשר לאבד או לשכוח לעדכן.
 *
 * שתי גרסאות:
 *  • רגילה — האייקון ממלא את הריבוע (לדפדפן, ל-iOS, ללשונית)
 *  • maskable — אנדרואיד חותך אותו לצורה של המערכת (עיגול/ריבוע מעוגל),
 *    ולכן התוכן מוקטן ל-60% ויושב במרכז, אחרת הקצוות נחתכים
 */

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");

const ROSE_DARK = "#a32a60";
const ROSE = "#d4568f";
const ROSE_LIGHT = "#f2a2c4";
const CREAM = "#fff6fa";

/**
 * הסמל: ראש תינוקת ישנה בתוך סהר, עם כוכבים קטנים.
 *
 * שלושה שיקולים:
 *  • **מעבר צבע ולא צבע שטוח** — נותן עומק בגודל קטן, שם צל לא נקרא.
 *  • **הסהר עוטף את הפנים** — צורה אחת מזוהה גם ב-48 פיקסלים, במקום
 *    שני אלמנטים נפרדים שמתמזגים לכתם.
 *  • **עיניים עצומות ולא פתוחות** — קו אחד מעוגל נקרא כשינה גם כשהוא
 *    קטן, ושתי נקודות נראות כמו רעש.
 */
function gradients() {
  return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${ROSE_LIGHT}"/>
      <stop offset="55%" stop-color="${ROSE}"/>
      <stop offset="100%" stop-color="${ROSE_DARK}"/>
    </linearGradient>
  </defs>`;
}

function glyph(scale = 1, tx = 0, ty = 0) {
  return `
  <g transform="translate(${tx} ${ty}) scale(${scale})">
    <g fill="none" stroke="${CREAM}" stroke-width="24"
       stroke-linecap="round" stroke-linejoin="round">
      <!-- ראש -->
      <circle cx="228" cy="246" r="100"/>
      <!-- עיניים עצומות: קשת אחת לכל עין נקראת כשינה גם בגודל קטן -->
      <path d="M176 224a20 20 0 0 1 32 0"/>
      <path d="M248 224a20 20 0 0 1 32 0"/>
      <!-- חיוך: רחב ורדוד, כדי שלא יתמזג עם העיניים בגודל קטן -->
      <path d="M198 292a38 38 0 0 0 60 0"/>
      <!-- גוף -->
      <path d="M114 438a114 114 0 0 1 228 0"/>
      <!-- סהר נפרד וברור, לא טבעת מאחורי הפנים -->
      <path d="M432 122a46 46 0 1 1-46-46 36 36 0 0 0 46 46Z"/>
    </g>
    <!-- כוכבים -->
    <g fill="${CREAM}">
      <circle cx="330" cy="70" r="9"/>
      <circle cx="446" cy="214" r="7"/>
    </g>
  </g>`;
}

const square = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${gradients()}${inner}</svg>`;

const plain = square(`<circle cx="256" cy="256" r="256" fill="url(#bg)"/>${glyph()}`);
const maskable = square(
  // מרכז המסה של הסמל אינו מרכז הבד (הכוכבים מושכים ימינה), ולכן תיקון קטן
  `<rect width="512" height="512" fill="url(#bg)"/>${glyph(0.62, 90, 100)}`,
);

const targets = [
  { file: "icon-192.png", size: 192, svg: plain },
  { file: "icon-512.png", size: 512, svg: plain },
  { file: "icon-maskable-192.png", size: 192, svg: maskable },
  { file: "icon-maskable-512.png", size: 512, svg: maskable },
  // iOS מתעלם מ-maskable ולא מוסיף פינות מעוגלות בעצמו לאייקון שקוף
  { file: "apple-touch-icon.png", size: 180, svg: plain },
  { file: "icon-32.png", size: 32, svg: plain },
];

await mkdir(outDir, { recursive: true });

for (const { file, size, svg } of targets) {
  const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  await writeFile(join(outDir, file), png);
  console.log(`✓ ${file} (${size}×${size})`);
}

// favicon.ico בפורמט PNG — נתמך בכל דפדפן מודרני
await writeFile(
  join(root, "app", "icon.png"),
  await sharp(Buffer.from(plain)).resize(64, 64).png().toBuffer(),
);
console.log("✓ app/icon.png (64×64)");
