"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui";
import { frameToBlob } from "@/lib/photos";

/**
 * צילום בתוך האתר.
 *
 * למה לא פשוט `<input capture>`: הוא פותח את אפליקציית המצלמה של
 * המכשיר, וזו שומרת את התמונה בגלריה. מי שמצלם תיעוד רפואי כמה פעמים
 * ביום מוצא את הגלריה שלו מלאה בתמונות שלא רצה לשמור.
 *
 * כאן הפריים נלכד מזרם הווידאו ישירות לזיכרון, נדחס ועולה. שום קובץ
 * לא נכתב למכשיר.
 */
export function CameraSheet({
  onCapture,
  onClose,
}: {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1920 } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (e) {
        const name = (e as Error)?.name;
        setError(
          name === "NotAllowedError"
            ? "אין הרשאה למצלמה. אפשר לאשר בהגדרות האתר בדפדפן."
            : name === "NotFoundError"
              ? "לא נמצאה מצלמה במכשיר הזה"
              : "לא הצלחנו לפתוח את המצלמה",
        );
      }
    }

    start();

    return () => {
      cancelled = true;
      // עצירת המצלמה חובה — אחרת הנורית נשארת דולקת אחרי הסגירה
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing]);

  async function shoot() {
    const video = videoRef.current;
    if (!video || busy) return;

    setBusy(true);
    try {
      const blob = await frameToBlob(video, video.videoWidth, video.videoHeight);
      onCapture(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : "הצילום נכשל");
      setBusy(false);
    }
  }

  return (
    <Sheet title="צילום" onClose={onClose}>
      {error ? (
        <div className="flex flex-col gap-3">
          <p role="alert" className="text-[0.9375rem] leading-relaxed text-late">
            {error}
          </p>
          <Button variant="secondary" fullWidth onClick={onClose}>
            סגירה
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-2">
          <div className="overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              // הפוך רק במצלמה הקדמית, כדי שהתצוגה תרגיש כמו מראה
              className={`h-[45dvh] w-full object-cover ${facing === "user" ? "scale-x-[-1]" : ""}`}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                setFacing((f) => (f === "environment" ? "user" : "environment"))
              }
              aria-label="החלפת מצלמה"
            >
              היפוך
            </Button>
            <Button fullWidth disabled={!ready || busy} onClick={shoot}>
              {busy ? "שומר…" : "צילום"}
            </Button>
          </div>

          <p className="text-center text-[0.75rem] text-faint">
            התמונה נשמרת ליומן בלבד ולא נשמרת בגלריה של המכשיר.
          </p>
        </div>
      )}
    </Sheet>
  );
}
