import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { THEME_COOKIE, THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orient Travel CRM",
  description: "CRM для обработки лидов туристического агентства Orient Travel",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  return (
    <html lang="ru" className={theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {/* Toaster монтируется раньше страниц, чтобы уведомления, показанные при загрузке, не терялись */}
        <Toaster position="top-right" richColors closeButton theme={theme === "dark" ? "dark" : "light"} />
        {children}
      </body>
    </html>
  );
}
