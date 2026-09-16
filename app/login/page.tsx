import { LoginForm } from "@/components/login-form";

export const metadata = { title: "כניסה · היומן של התינוק" };

/**
 * הודעת שגיאה מגיעה כפרמטר ב-URL מ-/auth/callback.
 * קוראים אותה בשרת כדי שהטופס יעלה כבר עם השגיאה, בלי הבהוב.
 */
export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const raw = params.error;
  const error = Array.isArray(raw) ? raw[0] : raw;

  return <LoginForm initialError={error} />;
}
