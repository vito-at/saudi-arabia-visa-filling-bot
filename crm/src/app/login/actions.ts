"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { getI18n } from "@/i18n/server";
import { prisma } from "@/lib/db";

export type LoginState = { error: string | null; login: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const login = String(formData.get("login") ?? "");
  try {
    // визовый специалист сразу попадает в свой кабинет
    const role = (await prisma.user.findUnique({ where: { login: login.trim().toLowerCase() }, select: { role: true } }))?.role;
    await signIn("credentials", { login, password: String(formData.get("password") ?? ""), redirectTo: role === "VISA" ? "/visa" : "/" });
    return { error: null, login };
  } catch (e) {
    if (e instanceof AuthError) return { error: (await getI18n()).t("auth.invalid"), login };
    throw e; // редирект после успешного входа
  }
}
