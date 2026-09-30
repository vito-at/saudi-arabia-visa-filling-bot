import type { Locale } from "../config";
import { en } from "./en";
import { ru, type Messages } from "./ru";
import { uz } from "./uz";

export const MESSAGES: Record<Locale, Messages> = { ru, uz, en };
export { ru };
