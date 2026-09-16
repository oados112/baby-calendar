import type { MetadataRoute } from "next";

/**
 * המניפסט שהופך את האתר להתקנה במסך הבית.
 *
 * באנדרואיד: כרום מציע "התקנת אפליקציה" ופותח אותה במסך מלא בלי סרגל
 * כתובת, עם האייקון שלנו במגירת האפליקציות.
 * באייפון: חובה "הוסף למסך הבית" ידנית, וזה גם התנאי להתראות פוש.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "היומן של התינוק",
    short_name: "היומן",
    description: "מעקב האכלות, שינה, חיתולים ובריאות — משותף לכל המשפחה",
    lang: "he",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf9f7",
    theme_color: "#0d7d75",
    categories: ["health", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // קיצורי דרך בלחיצה ארוכה על האייקון באנדרואיד
    shortcuts: [
      {
        name: "רישום האכלה",
        url: "/?log=feed",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "רישום חיתול",
        url: "/?log=diaper",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
