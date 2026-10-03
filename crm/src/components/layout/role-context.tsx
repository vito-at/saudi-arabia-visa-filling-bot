"use client";

import { createContext, useContext } from "react";

const RoleContext = createContext<{ role: "ADMIN" | "MANAGER"; costRate: number; saleRate: number }>({ role: "MANAGER", costRate: 0, saleRate: 0 });

/**
 * Роль текущего пользователя для клиентских компонентов (права всё равно проверяются на сервере)
 * и текущие курсы $ (продажи и покупки) — для пересчёта сумм в окнах сделок.
 */
export function RoleProvider({ role, costRate, saleRate, children }: { role: "ADMIN" | "MANAGER"; costRate: number; saleRate: number; children: React.ReactNode }) {
  return <RoleContext.Provider value={{ role, costRate, saleRate }}>{children}</RoleContext.Provider>;
}

export const useIsAdmin = () => useContext(RoleContext).role === "ADMIN";
export const useCostRate = () => useContext(RoleContext).costRate;
/** Текущие курсы $: sale — продажа, cost — покупка */
export const useRates = () => {
  const { saleRate, costRate } = useContext(RoleContext);
  return { sale: saleRate, cost: costRate || saleRate };
};
