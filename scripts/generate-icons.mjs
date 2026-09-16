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

const TEAL = "#0d7d75";
const CREAM = "#faf9f7";

/** הסמל עצמו: ראש תינוק ישן עם ירח קטן. נקי וקריא גם ב-48 פיקסלים. */
function glyph(scale = 1, tx = 0, ty = 0) {
  return `
  <g transform="translate(${tx} ${ty}) scale(${scale})" >
    <circle cx="256" cy="256" r="256" fill="${TEAL}"/>
    <g fill="none" stroke="${CREAM}" stroke-width="26"
       stroke-linecap="round" stroke-linejoin="round">
      <circle cx="228" cy="232" r="96"/>
      <path d="M198 222h0.01M258 222h0.01" stroke-width="30"/>
      <path d="M204 268a42 42 0 0 0 58 0"/>
      <path d="M112 432a116 116 0 0 1 232 0"/>
      <path d="M430 118a46 46 0 1 1-46-46 36 36 0 0 0 46 46Z"/>
    </g>
  </g>`;
}

const square = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${inner}</svg>`;

const plain = square(glyph());
const maskable = square(
  // מרכז המסה של הסמל אינו מרכז הבד (הירח מושך ימינה), ולכן תיקון קטן
  `<rect width="512" height="512" fill="${TEAL}"/>${glyph(0.62, 88, 100)}`,
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
