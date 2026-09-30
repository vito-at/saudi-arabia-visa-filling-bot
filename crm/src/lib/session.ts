import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "./db";
import type { TKey } from "@/i18n/core";

export type CurrentUser = Pick<User, "id" | "name" | "login" | "role">;

/** Текущий пользователь из БД (проверяем, что он не заблокирован). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, login: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return { id: user.id, name: user.name, login: user.login, role: user.role };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

export function isAdmin(user: Pick<User, "role">) {
  return user.role === "ADMIN";
}

/** Нет доступа; message — ключ перевода (err.*), переводится в runAction */
export class AccessError extends Error {
  constructor(message: TKey = "err.noAccess") {
    super(message);
  }
}
