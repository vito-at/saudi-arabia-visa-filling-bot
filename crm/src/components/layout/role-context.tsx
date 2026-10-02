"use client";

import { createContext, useContext } from "react";

const RoleContext = createContext<"ADMIN" | "MANAGER">("MANAGER");

/** Роль текущего пользователя для клиентских компонентов (права всё равно проверяются на сервере) */
export function RoleProvider({ role, children }: { role: "ADMIN" | "MANAGER"; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export const useIsAdmin = () => useContext(RoleContext) === "ADMIN";
