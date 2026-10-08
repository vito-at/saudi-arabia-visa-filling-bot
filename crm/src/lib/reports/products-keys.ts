import type { ServiceType } from "@prisma/client";
import { SERVICE_TYPES } from "@/lib/constants";

export type ProductKey = ServiceType | "none";
/** Колонки «Продаж по продуктам»: типы услуг и «Не указан» */
export const PRODUCT_KEYS: ProductKey[] = [...SERVICE_TYPES, "none"];
