"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { getI18n } from "@/i18n/server";

export type LoginState = { error: string | null; login: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const login = String(formData.get("login") ?? "");
  try {
    await signIn("credentials", { login, password: String(formData.get("password") ?? ""), redirectTo: "/" });
    return { error: null, login };
  } catch (e) {
    if (e instanceof AuthError) return { error: (await getI18n()).t("auth.invalid"), login };
    throw e; // редирект после успешного входа
  }
}
