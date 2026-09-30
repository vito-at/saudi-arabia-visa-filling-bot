import type { LeadSource, ServiceType } from "@prisma/client";
import type { NewLeadInput } from "@/lib/leads/service";

/** Лид в формате Graph API (GET /{form_id}/leads или GET /{leadgen_id}) */
export interface MetaLead {
  id: string;
  created_time: string;
  field_data?: { name: string; values?: string[] }[];
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  platform?: string;
  is_organic?: boolean;
}

export const LEAD_FIELDS = "id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform,is_organic";

export interface FormAnswer {
  key: string;
  label: string;
  value: string;
}

// Стандартные поля Lead Ads и их варианты в кастомных вопросах (рус/узб/англ)
const NAME_KEYS = ["full_name", "name", "имя", "фио", "ism", "ismingiz", "your_name"];
const FIRST_NAME_KEYS = ["first_name", "имя"];
const LAST_NAME_KEYS = ["last_name", "фамилия"];
const PHONE_KEYS = ["phone_number", "phone", "телефон", "номер_телефона", "telefon", "telefon_raqam", "mobile"];
const EMAIL_KEYS = ["email", "e-mail", "почта"];

const DEST_HINTS = ["направлен", "куда", "страна", "город", "destination", "country", "where", "yo'nalish", "yonalish", "qayer", "davlat"];
const PEOPLE_HINTS = ["человек", "туристов", "кол-во", "количество", "сколько", "people", "persons", "travelers", "travellers", "guests", "kishi", "nechta", "necha"];
const DATE_HINTS = ["дата", "когда", "date", "when", "sana", "qachon", "срок"];
const SERVICE_HINTS = ["услуг", "service", "xizmat", "тип"];

const norm = (s: string) => s.toLowerCase().replace(/[\s?:.!,]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
const has = (key: string, hints: string[]) => hints.some((h) => key.includes(h));

/** Значения вариантов ответа приходят как ключи вида «через_1-2_месяца» — делаем читаемыми */
function humanize(v: string): string {
  return v.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

/** Разбор даты из ответа: 2026-10-15, 15.10.2026, 15/10/2026 */
export function parseAnswerDate(v: string): Date | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+05:00`);
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return new Date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T00:00:00+05:00`);
  return null;
}

export function parseTravelers(v: string): number | null {
  const m = v.match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return n >= 1 && n <= 500 ? n : null;
}

export function guessService(text: string): ServiceType | null {
  const t = text.toLowerCase();
  if (/умр|umra|хадж|hajj/.test(t)) return "UMRAH";
  if (/авиа|билет|avia|chipta|flight|ticket/.test(t)) return "FLIGHTS";
  if (/виз|viza|visa/.test(t)) return "VISA";
  if (/мед|лечен|клиник|davolan|medical|clinic/.test(t)) return "MEDICAL";
  if (/узбекист|въезд|inbound|по узбекистану/.test(t)) return "INBOUND_TOUR";
  if (/тур|tour|sayohat|отдых/.test(t)) return "OUTBOUND_TOUR";
  return null;
}

/** Meta отдаёт created_time как 2026-09-30T10:00:00+0000 */
export function parseMetaTime(s: string): Date {
  const fixed = s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const d = new Date(fixed);
  if (Number.isNaN(d.getTime())) throw new Error(`Некорректная дата лида: ${s}`);
  return d;
}

export function platformToSource(platform?: string): LeadSource {
  const p = (platform ?? "").toLowerCase();
  return p === "ig" || p.includes("instagram") ? "META_IG" : "META_FB";
}

/**
 * Преобразование лида Meta во входные данные CRM.
 * @param labels подписи вопросов формы: key → label (из GET /{form_id}?fields=questions)
 */
export function parseMetaLead(lead: MetaLead, opts: { formName?: string | null; labels?: Record<string, string> } = {}): NewLeadInput {
  const labels = opts.labels ?? {};
  let name: string | null = null;
  let first: string | null = null;
  let last: string | null = null;
  let phone: string | null = null;
  let email: string | null = null;
  let destination: string | null = null;
  let travelers: number | null = null;
  let travelFrom: Date | null = null;
  let service: ServiceType | null = null;
  const answers: FormAnswer[] = [];

  for (const f of lead.field_data ?? []) {
    const rawValues = (f.values ?? []).map((v) => String(v).trim()).filter(Boolean);
    if (!rawValues.length) continue;
    const key = norm(f.name);
    const raw = rawValues.join(", ");
    const value = rawValues.map(humanize).join(", ");

    if (FIRST_NAME_KEYS.includes(key) && key !== "имя") {
      first = raw;
      continue;
    }
    if (LAST_NAME_KEYS.includes(key)) {
      last = raw;
      continue;
    }
    if (NAME_KEYS.includes(key)) {
      name = raw;
      continue;
    }
    if (PHONE_KEYS.includes(key)) {
      phone = raw;
      continue;
    }
    if (EMAIL_KEYS.includes(key)) {
      email = raw.toLowerCase();
      continue;
    }

    // кастомный вопрос: сохраняем всегда, плюс пытаемся заполнить поля карточки
    const label = labels[f.name] ?? humanize(f.name);
    answers.push({ key: f.name, label: label.charAt(0).toUpperCase() + label.slice(1), value });
    const searchKey = norm(`${f.name} ${labels[f.name] ?? ""}`);
    if (!destination && has(searchKey, DEST_HINTS)) destination = value;
    else if (travelers === null && has(searchKey, PEOPLE_HINTS)) travelers = parseTravelers(value);
    else if (!travelFrom && has(searchKey, DATE_HINTS)) travelFrom = parseAnswerDate(raw);
    if (!service && has(searchKey, SERVICE_HINTS)) service = guessService(value);
  }

  if (!name) name = [first, last].filter(Boolean).join(" ") || null;
  if (!service) service = guessService(`${opts.formName ?? ""} ${lead.campaign_name ?? ""}`);
  const created = parseMetaTime(lead.created_time);

  return {
    leadgenId: lead.id,
    source: platformToSource(lead.platform),
    name: name ?? "Без имени",
    phone,
    email,
    destination,
    travelers,
    travelFrom,
    serviceType: service,
    formAnswers: answers.length ? (answers as unknown as NewLeadInput["formAnswers"]) : undefined,
    formId: lead.form_id ?? null,
    formName: opts.formName ?? null,
    campaignId: lead.campaign_id ?? null,
    campaignName: lead.campaign_name ?? null,
    adsetId: lead.adset_id ?? null,
    adsetName: lead.adset_name ?? null,
    adId: lead.ad_id ?? null,
    adName: lead.ad_name ?? null,
    platform: lead.platform ?? null,
    metaCreatedAt: created,
  };
}
