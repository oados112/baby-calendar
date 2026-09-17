"use client";

import type { LogInput } from "@/lib/data/log";

/**
 * תור רישומים לא מסונכרנים.
 *
 * למה זה קיים: הרישומים האלה נעשים במעלית, בחדר לידה, במרפאה עם קליטה
 * גרועה — בדיוק במקומות שבהם הרשת נופלת. רישום שנעלם כי לא הייתה רשת
 * הוא גרוע יותר מאתר איטי, כי ההורה כבר לא זוכר מה בדיוק היה.
 *
 * הפתרון: אם הכתיבה נכשלה מסיבת רשת, הרישום נשמר ב-IndexedDB ונשאר על
 * המסך מסומן כ"ממתין". הוא נשלח מחדש כשהחיבור חוזר, גם אחרי סגירת
 * הדפדפן ואפילו אחרי הפעלה מחדש של הטלפון.
 *
 * IndexedDB ולא localStorage: התור צריך לשרוד גם כשהאחסון מתמלא, והוא
 * נכתב מתוך אירועים אסינכרוניים שלא אמורים לחסום את הממשק.
 */

const DB_NAME = "baby-calendar";
const DB_VERSION = 1;
const STORE = "pending-events";

export interface PendingEntry {
  id: string;
  /** אותו מזהה זמני שמוצג ברשימה, כדי לחבר בין השורה לרשומה בתור */
  tempId: string;
  input: SerializedInput;
  createdAt: number;
  attempts: number;
}

interface SerializedInput extends Omit<LogInput, "startedAt" | "endedAt"> {
  startedAt: string;
  endedAt?: string | null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = fn(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

const listeners = new Set<() => void>();
let cachedSize = 0;

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeToQueue(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const readQueueSize = () => cachedSize;
export const readQueueSizeOnServer = () => 0;

async function refreshSize() {
  try {
    cachedSize = (await withStore<PendingEntry[]>("readonly", (s) => s.getAll())).length;
  } catch {
    cachedSize = 0;
  }
  notify();
}

export function serializeInput(input: LogInput): SerializedInput {
  return {
    ...input,
    startedAt: input.startedAt.toISOString(),
    endedAt: input.endedAt ? input.endedAt.toISOString() : null,
  };
}

export function deserializeInput(input: SerializedInput): LogInput {
  return {
    ...input,
    startedAt: new Date(input.startedAt),
    endedAt: input.endedAt ? new Date(input.endedAt) : null,
  };
}

export async function enqueue(tempId: string, input: LogInput): Promise<void> {
  const entry: PendingEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tempId,
    input: serializeInput(input),
    createdAt: Date.now(),
    attempts: 0,
  };

  await withStore("readwrite", (store) => store.put(entry));
  await refreshSize();
}

export async function listPending(): Promise<PendingEntry[]> {
  const entries = await withStore<PendingEntry[]>("readonly", (s) => s.getAll());
  return entries.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removePending(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
  await refreshSize();
}

async function bumpAttempts(entry: PendingEntry): Promise<void> {
  await withStore("readwrite", (store) =>
    store.put({ ...entry, attempts: entry.attempts + 1 }),
  );
}

/**
 * האם הכשל הוא של הרשת ולא של הנתונים.
 *
 * ההבחנה קריטית: רישום שנדחה כי הוא לא תקין יחזור ויידחה לנצח, ואין
 * טעם לשמור אותו בתור. רק כשל תקשורת ראוי לניסיון חוזר.
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    error.name === "TypeError" ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("load failed")
  );
}

/** ניסיונות חוזרים כושלים מספיק פעמים — כנראה לא הרשת. לא שומרים לנצח. */
const MAX_ATTEMPTS = 8;

/**
 * שולח מחדש את כל הממתינים.
 * מחזיר כמה נשלחו בהצלחה. עוצר בכשל רשת ראשון, כדי לא לשרוף ניסיונות.
 */
export async function flushQueue(
  send: (input: LogInput) => Promise<unknown>,
): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;

  const pending = await listPending();
  let sent = 0;

  for (const entry of pending) {
    try {
      await send(deserializeInput(entry.input));
      await removePending(entry.id);
      sent += 1;
    } catch (error) {
      if (isNetworkError(error)) break; // עדיין אין רשת — ננסה שוב בפעם הבאה

      if (entry.attempts + 1 >= MAX_ATTEMPTS) {
        // נכשל שוב ושוב מסיבה שאינה רשת. מסירים כדי שלא ייתקע לנצח.
        await removePending(entry.id);
      } else {
        await bumpAttempts(entry);
      }
    }
  }

  await refreshSize();
  return sent;
}

/** נקרא פעם אחת בטעינת האפליקציה. */
export function initQueue() {
  if (typeof indexedDB === "undefined") return;
  refreshSize();
}
