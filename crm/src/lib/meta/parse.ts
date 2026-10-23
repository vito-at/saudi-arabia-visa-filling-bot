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

/**
 * Свой вопрос с именем в форме («Ваше имя?», «Ismingiz?», «Как к вам обращаться?») — не стандартное поле Meta full_name.
 * Ключ и подпись приводятся к виду «ваше_имя», «ismingiz_va_familiyangiz».
 */
const NAME_QUESTION = /(^|[_-])(имя|фио|ф_и_о|name|ism|ismi|ismingiz|ismingizni|исм|исмингиз|familiya|фамилия)([_-]|$)|как_вас_зовут|как_к_вам_обращаться|ваше_имя|ism_familiya|ismingiz/;
const NOT_NAME_QUESTION = /company|компан|kompaniya|form_name|название/;

export function isNameQuestion(searchKey: string): boolean {
  return NAME_QUESTION.test(searchKey) && !NOT_NAME_QUESTION.test(searchKey);
}

/** Свой вопрос с телефоном: «Номер телефона для связи?», «Telefon raqamingiz?», «Aloqa uchun raqam» */
const PHONE_QUESTION = /телефон|номер|nomer|raqam|phone|mobile|telefon|whatsapp|telegram|aloqa|связ/;

export function isPhoneQuestion(searchKey: string): boolean {
  return PHONE_QUESTION.test(searchKey);
}

/** Ответ похож на номер телефона: 9–15 цифр, без слов */
export function looksLikePhone(v: string): boolean {
  const digits = v.replace(/\D/g, "").length;
  return digits >= 9 && digits <= 15 && !/[a-zа-яё]{2,}/i.test(v);
}

/** Телефон из сохранённых ответов формы — для лидов, где номер был в своём вопросе, а не в стандартном поле Meta */
export function phoneFromAnswers(answers: unknown): string | null {
  if (!Array.isArray(answers)) return null;
  const list = (answers as Partial<FormAnswer>[]).filter((a) => typeof a?.value === "string" && looksLikePhone(a.value));
  const byQuestion = list.find((a) => isPhoneQuestion(norm(`${a.key ?? ""} ${a.label ?? ""}`)));
  return (byQuestion ?? list[0])?.value?.trim() ?? null;
}

/**
 * Количество туристов и примерная дата выезда из ответов формы — как их написал клиент («2 взрослых и ребёнок»,
 * «в ноябре», «через 1-2 месяца»): показываются в карточке, если в поля лида их не удалось разобрать.
 */
export function tripFromAnswers(answers: unknown): { people: string | null; when: string | null } {
  const out = { people: null as string | null, when: null as string | null };
  if (!Array.isArray(answers)) return out;
  for (const a of answers as Partial<FormAnswer>[]) {
    if (typeof a?.value !== "string" || !a.value.trim()) continue;
    const key = norm(`${a.key ?? ""} ${a.label ?? ""}`);
    if (!out.people && has(key, PEOPLE_HINTS)) out.people = a.value.trim();
    else if (!out.when && has(key, DATE_HINTS)) out.when = a.value.trim();
  }
  return out;
}

/** Ответ похож на имя: без цифр и не слишком длинный */
export function looksLikeName(v: string): boolean {
  const t = v.trim();
  return t.length >= 2 && t.length <= 60 && !/\d/.test(t);
}

/** Имя из сохранённых ответов формы — для лидов, загруженных до распознавания своих вопросов с именем */
export function nameFromAnswers(answers: unknown): string | null {
  if (!Array.isArray(answers)) return null;
  for (const a of answers as Partial<FormAnswer>[]) {
    if (typeof a?.value !== "string") continue;
    if (isNameQuestion(norm(`${a.key ?? ""} ${a.label ?? ""}`)) && looksLikeName(a.value)) return a.value.trim();
  }
  return null;
}

/** Значения вариантов ответа приходят как ключи вида «через_1-2_месяца» — делаем читаемыми */
function humanize(v: string): string {
  return v.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Разбор даты из ответа: 2026-10-15, 15.10.2026, 15/10/2026. Несуществующая дата («12/25/2026», «31.02.2026») — null:
 * иначе база отклоняла лид целиком, и он терялся.
 */
export function parseAnswerDate(v: string): Date | null {
  const s = v.trim();
  let ymd: number[] | null = null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) ymd = [m[1], m[2], m[3]].map(Number);
  else if ((m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/))) ymd = [m[3], m[2], m[1]].map(Number);
  if (!ymd) return null;
  const [y, mo, d] = ymd;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(`${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T00:00:00+05:00`);
  // 31.02 превратилась бы в 3 марта — такую дату не принимаем
  if (Number.isNaN(date.getTime()) || new Date(date.getTime() + 5 * 3_600_000).getUTCDate() !== d) return null;
  return date;
}

export function parseTravelers(v: string): number | null {
  const m = v.match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return n >= 1 && n <= 500 ? n : null;
}

export function guessService(text: string): ServiceType | null {
  const t = text.toLowerCase();
  if (/авиа|билет|avia|chipta|flight|ticket/.test(t)) return "FLIGHTS";
  if (/виз|viza|visa/.test(t)) return "VISA";
  if (/тур|tour|sayohat|отдых/.test(t)) return "TOUR";
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
    if (!name && isNameQuestion(searchKey) && looksLikeName(raw)) {
      name = raw;
      continue;
    }
    // телефон в своём вопросе формы — в поле телефона лида (ответ остаётся и в анкете)
    if (!phone && isPhoneQuestion(searchKey) && looksLikePhone(raw)) {
      phone = raw;
      continue;
    }
    if (!destination && has(searchKey, DEST_HINTS)) destination = value;
    else if (travelers === null && has(searchKey, PEOPLE_HINTS)) travelers = parseTravelers(value);
    else if (!travelFrom && has(searchKey, DATE_HINTS)) travelFrom = parseAnswerDate(raw);
    if (!service && has(searchKey, SERVICE_HINTS)) service = guessService(value);
  }

  if (!name) name = [first, last].filter(Boolean).join(" ") || null;
  // номер мог прийти в вопросе без «телефон» в названии — берём первый ответ, похожий на номер
  if (!phone) phone = phoneFromAnswers(answers);
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
    isOrganic: typeof lead.is_organic === "boolean" ? lead.is_organic : null,
    metaCreatedAt: created,
  };
}
