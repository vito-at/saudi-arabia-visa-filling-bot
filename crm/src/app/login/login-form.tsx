"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { loginAction } from "./actions";
import { useI18n } from "@/i18n/client";

export function LoginForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(loginAction, { error: null, login: "" });
  return (
    <form action={action} className="space-y-4">
      <Field label={t("auth.login")}>
        <Input name="login" autoComplete="username" required autoFocus defaultValue={state.login} key={state.login} />
      </Field>
      <Field label={t("auth.password")}>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("auth.submitting") : t("auth.submit")}
      </Button>
    </form>
  );
}
