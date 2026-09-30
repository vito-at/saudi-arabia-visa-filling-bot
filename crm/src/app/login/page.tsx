import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background">
      <div className="absolute right-6 top-6 w-44">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-xl">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Logo className="h-14" />
          <p className="text-sm text-muted-foreground">Вход в CRM</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
