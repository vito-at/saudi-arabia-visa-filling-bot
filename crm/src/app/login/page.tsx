import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--sidebar)]">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-white">OT</div>
          <h1 className="text-xl font-semibold">Orient Travel CRM</h1>
          <p className="text-sm text-muted-foreground">Вход в систему</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
