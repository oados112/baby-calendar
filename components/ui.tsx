"use client";

import { forwardRef, useId } from "react";

/**
 * רכיבי היסוד.
 * כל כפתור ושדה באתר עוברים דרך כאן — כך גובה המגע, הרדיוסים, טבעת המיקוד
 * והתנהגות המצבים נשארים זהים בכל מסך בלי לחזור על עצמנו.
 */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "bg-surface-sunken text-strong border border-line hover:border-line-strong",
  ghost: "text-accent-text hover:bg-accent-soft",
  danger: "bg-late text-white",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** מציג מצב טעינה וחוסם לחיצות נוספות */
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", loading, fullWidth, className = "", children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "inline-flex min-h-tap-comfy items-center justify-center gap-2 rounded-lg px-5",
        "text-[1rem] font-semibold",
        "transition-[transform,background-color] duration-150",
        "active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100",
        BUTTON_VARIANTS[variant],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
});

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 animate-spin" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** טקסט עזר קבוע מתחת לשדה */
  hint?: string;
  /** הודעת שגיאה — מחליפה את ה-hint ומסמנת את השדה */
  error?: string | null;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField({ label, hint, error, className = "", ...props }, ref) {
    const id = useId();
    const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-[0.875rem] font-medium text-default">
          {label}
        </label>
        <input
          ref={ref}
          id={id}
          {...props}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={[
            "min-h-tap-comfy rounded-lg border bg-surface-sunken px-4",
            // 1rem לפחות: גופן קטן יותר גורם ל-iOS להגדיל את המסך אוטומטית
            "text-[1rem] text-strong placeholder:text-faint",
            "transition-colors duration-150",
            error ? "border-late" : "border-line focus:border-accent",
            className,
          ].join(" ")}
        />
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-[0.8125rem] text-late">
            {error}
          </p>
        ) : hint ? (
          <p id={`${id}-hint`} className="text-[0.8125rem] text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
