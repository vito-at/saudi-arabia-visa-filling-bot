import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LoginForm } from "./login-form";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getI18n } from "@/i18n/server";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const { t } = await getI18n();
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background">
      <div className="absolute right-6 top-6 w-44 space-y-2">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-xl">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Logo className="h-14" />
          <p className="text-sm text-muted-foreground">{t("auth.subtitle")}</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
