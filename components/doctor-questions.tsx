"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { shortDate } from "@/lib/zoned";
import type { DoctorQuestionRow } from "@/types/db";

/**
 * שאלות לרופא.
 *
 * נזכרים בשאלה בשלוש לפנות בוקר — "האם הצבע הזה תקין?", "מתי מתחילים
 * ויטמין ברזל?" — ושוכחים אותה בדיוק בחדר הטיפולים. כאן היא ממתינה.
 *
 * שתי החלטות שמגדירות את הרכיב:
 *
 * **הוספה בשדה אחד.** שאלה נכתבת ביד אחת, לרוב באמצע משהו אחר. אין
 * כאן קטגוריה, אין עדיפות ואין תאריך יעד — רק שורה וכפתור.
 *
 * **השאלה לא נמחקת כשעונים עליה.** מסמנים אותה כנענתה ואפשר לכתוב מה
 * נאמר. זה מה שהופך את הרשימה לתיעוד של מה שהרופא אמר, ולא רק לרשימת
 * מטלות שמתרוקנת.
 */
export function DoctorQuestions({
  babyId,
  currentUserId,
  questions,
  canEdit,
}: {
  babyId: string;
  currentUserId: string;
  questions: DoctorQuestionRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answering, setAnswering] = useState<DoctorQuestionRow | null>(null);

  const open = questions.filter((q) => !q.answered_at);
  const answered = questions.filter((q) => q.answered_at);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || busy) return;

    setBusy(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    // family_id לא נשלח — טריגר במסד גוזר אותו מהתינוק/ת
    const { error: failed } = await supabase
      .from("doctor_questions")
      .insert({ baby_id: babyId, text: value, created_by: currentUserId });

    setBusy(false);

    if (failed) {
      setError(failed.message);
      return;
    }

    setText("");
    router.refresh();
  }

  async function remove(id: string) {
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: failed } = await supabase
      .from("doctor_questions")
      .delete()
      .eq("id", id);

    if (failed) setError(failed.message);
    else router.refresh();
  }

  return (
    <section className="rounded-lg border border-subtle bg-surface-card p-4">
      <h2 className="text-[0.9375rem] font-semibold text-strong">שאלות לרופא</h2>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
        מוסיפים שאלה מתי שנזכרים, והיא מחכה כאן לביקור הבא.
      </p>

      {canEdit ? (
        <form onSubmit={add} className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder="מה לשאול?"
            className="min-h-tap-comfy flex-1 rounded-md border border-line bg-surface-sunken px-3 text-[1rem] text-strong placeholder:text-faint"
          />
          <Button type="submit" loading={busy} disabled={!text.trim()}>
            הוספה
          </Button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-[0.8125rem] text-late">
          {error}
        </p>
      ) : null}

      {open.length === 0 && answered.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-line px-4 py-6 text-center text-[0.8125rem] leading-relaxed text-muted">
          אין שאלות פתוחות.
        </p>
      ) : null}

      {open.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {open.map((q) => (
            <li
              key={q.id}
              className="flex items-start gap-2.5 rounded-md border border-subtle bg-surface-sunken px-3 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] leading-relaxed text-strong">
                  {q.text}
                </span>
                <span className="tnum block text-[0.75rem] text-faint">
                  נוספה {shortDate(q.created_at.slice(0, 10))}
                </span>
              </span>

              {canEdit ? (
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <button
                    onClick={() => setAnswering(q)}
                    className="text-[0.8125rem] font-medium text-accent-text underline underline-offset-2"
                  >
                    נענתה
                  </button>
                  <button
                    onClick={() => remove(q.id)}
                    className="text-[0.75rem] text-faint"
                  >
                    מחיקה
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {answered.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-[0.8125rem] text-muted">
            שאלות שנענו ({answered.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {answered.map((q) => (
              <li key={q.id} className="rounded-md bg-surface-sunken px-3 py-2.5">
                <p className="text-[0.875rem] leading-relaxed text-muted">{q.text}</p>
                {q.answer ? (
                  <p className="mt-1 text-[0.9375rem] leading-relaxed text-strong">
                    {q.answer}
                  </p>
                ) : null}
                <p className="tnum mt-1 text-[0.75rem] text-faint">
                  {shortDate((q.answered_at ?? q.created_at).slice(0, 10))}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {answering ? (
        <AnswerSheet
          question={answering}
          onClose={() => setAnswering(null)}
          onSaved={() => {
            setAnswering(null);
            router.refresh();
          }}
          onError={setError}
        />
      ) : null}
    </section>
  );
}

/**
 * מה שהרופא אמר.
 *
 * התשובה אינה חובה: לפעמים מספיק לסמן ששאלנו. לכן הכפתור שומר גם
 * כשהשדה ריק.
 */
function AnswerSheet({
  question,
  onClose,
  onSaved,
  onError,
}: {
  question: DoctorQuestionRow;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [answer, setAnswer] = useState(question.answer ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("doctor_questions")
      .update({
        answer: answer.trim() || null,
        answered_at: new Date().toISOString(),
      })
      .eq("id", question.id);

    if (error) {
      onError(error.message);
      setBusy(false);
      return;
    }

    onSaved();
  }

  return (
    <div className="mt-3 rounded-md border border-accent/40 bg-accent-soft p-3">
      <p className="text-[0.875rem] leading-relaxed text-strong">{question.text}</p>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={2}
        autoFocus
        placeholder="מה הרופא אמר (לא חובה)"
        className="mt-2 w-full rounded-md border border-line bg-surface-card px-3 py-2 text-[1rem] text-strong placeholder:text-faint"
      />
      <div className="mt-2 flex gap-2">
        <Button fullWidth loading={busy} onClick={save}>
          סימון כנענתה
        </Button>
        <Button variant="secondary" onClick={onClose}>
          ביטול
        </Button>
      </div>
    </div>
  );
}
