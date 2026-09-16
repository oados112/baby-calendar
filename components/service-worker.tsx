"use client";

import { useEffect } from "react";

/**
 * רישום ה-Service Worker.
 *
 * נרשם רק בפרודקשן: בפיתוח הוא היה משרת קבצים ישנים ומבלבל אחרי כל שינוי.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // כשל ברישום אינו שובר כלום — האתר פשוט לא יעבוד אופליין
      });
    };

    // אחרי הטעינה, כדי לא להתחרות על רוחב הפס עם הציור הראשון
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
