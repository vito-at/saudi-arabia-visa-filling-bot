"use client";

import { createContext, useContext } from "react";

const RoleContext = createContext<{ role: "ADMIN" | "MANAGER"; costRate: number }>({ role: "MANAGER", costRate: 0 });

/**
 * Роль текущего пользователя для клиентских компонентов (права всё равно проверяются на сервере)
 * и курс покупки $ — по нему администратор видит себестоимость в другой валюте.
 */
export function RoleProvider({ role, costRate, children }: { role: "ADMIN" | "MANAGER"; costRate: number; children: React.ReactNode }) {
  return <RoleContext.Provider value={{ role, costRate }}>{children}</RoleContext.Provider>;
}

export const useIsAdmin = () => useContext(RoleContext).role === "ADMIN";
export const useCostRate = () => useContext(RoleContext).costRate;
