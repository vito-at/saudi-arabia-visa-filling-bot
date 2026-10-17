/** Анкета клиента: ответы на вопросы, которые настраивает администратор */
import type { LeadQuestion } from "@prisma/client";
import { parseInputDate } from "@/lib/format";

export type ProfileAnswers = Record<string, string>;

export interface ProfileQuestionView {
  id: string;
  label: string;
  type: LeadQuestion["type"];
  options: string[];
  role: LeadQuestion["role"];
}

/** Сохранённые ответы из JSON лида */
export function readProfile(v: unknown): ProfileAnswers {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => typeof x === "string" && x.trim()).map(([k, x]) => [k, (x as string).trim()]));
}

export class ProfileError extends Error {
  constructor(public label: string) {
    super(label);
  }
}

/**
 * Проверить ответы по активным вопросам и слить с прежними: пустой ответ стирает значение, ответы на скрытые вопросы сохраняются.
 * Число — целое ≥ 0, дата — YYYY-MM-DD, выбор — один из вариантов. Возвращает новые ответы, даты поездки и подписи изменённых вопросов.
 */
export function mergeProfile(questions: ProfileQuestionView[], prev: ProfileAnswers, input: Record<string, string | undefined>) {
  const next: ProfileAnswers = { ...prev };
  const changed: string[] = [];
  let travelFrom: Date | null | undefined;
  let travelTo: Date | null | undefined;
  for (const q of questions) {
    if (!(q.id in input)) continue;
    const raw = (input[q.id] ?? "").trim().slice(0, 500);
    if (raw) {
      if (q.type === "NUMBER" && !/^\d{1,6}$/.test(raw)) throw new ProfileError(q.label);
      if (q.type === "DATE" && !parseInputDate(raw)) throw new ProfileError(q.label);
      if (q.type === "SELECT" && q.options.length && !q.options.includes(raw)) throw new ProfileError(q.label);
    }
    if ((prev[q.id] ?? "") !== raw) changed.push(q.label);
    if (raw) next[q.id] = raw;
    else delete next[q.id];
    if (q.role === "DEPART_DATE") travelFrom = raw ? parseInputDate(raw) : null;
    if (q.role === "RETURN_DATE") travelTo = raw ? parseInputDate(raw) : null;
  }
  return { answers: next, changed, travelFrom, travelTo };
}

/** Сколько активных вопросов заполнено */
export function profileFilled(questions: { id: string }[], answers: ProfileAnswers): number {
  return questions.filter((q) => answers[q.id]).length;
}
