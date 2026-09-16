import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "היומן של התינוק",
  description: "מעקב האכלות, שינה, חיתולים ובריאות — משותף לכל המשפחה",
  applicationName: "היומן של התינוק",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "היומן",
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // מאפשר הגדלה — נגישות. לא נועלים את הזום.
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1917" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full`}>
      <head>
        {/* קובע ערכת נושא לפני הציור הראשון כדי למנוע הבזק לבן בלילה */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full antialiased">
        <a href="#main" className="skip-link">
          דילוג לתוכן
        </a>
        {children}
      </body>
    </html>
  );
}
