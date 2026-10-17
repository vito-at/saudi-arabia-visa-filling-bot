/** Подборка туров для клиента: цена клиенту = цена туроператора + наценка агентства */
import type { TourOffer } from "@prisma/client";
import { formatDate, formatMoney, type Lang } from "@/lib/format";
import { toNum } from "@/lib/money";

export interface OfferView {
  id: string;
  hotel: string;
  stars: number | null;
  destination: string | null;
  meal: string | null;
  dateFrom: string | null; // YYYY-MM-DD
  nights: number | null;
  adults: number | null;
  children: number | null;
  operator: string | null;
  priceOperator: number;
  markup: number;
  currency: "USD" | "UZS";
  photoUrl: string | null;
  link: string | null;
  note: string | null;
}

export function toOfferView(o: TourOffer): OfferView {
  return {
    id: o.id,
    hotel: o.hotel,
    stars: o.stars,
    destination: o.destination,
    meal: o.meal,
    dateFrom: o.dateFrom ? o.dateFrom.toISOString().slice(0, 10) : null,
    nights: o.nights,
    adults: o.adults,
    children: o.children,
    operator: o.operator,
    priceOperator: toNum(o.priceOperator),
    markup: toNum(o.markup),
    currency: o.currency,
    photoUrl: o.photoUrl,
    link: o.link,
    note: o.note,
  };
}

export const offerPrice = (o: Pick<OfferView, "priceOperator" | "markup">) => Math.round((o.priceOperator + o.markup) * 100) / 100;

const WORDS: Record<Lang, { title: string; nights: string; adults: string; children: string; more: string }> = {
  ru: { title: "Подобрали для вас варианты туров:", nights: "ночей", adults: "взр.", children: "дет.", more: "Все варианты с фото" },
  uz: { title: "Siz uchun tur variantlarini tanladik:", nights: "kecha", adults: "katta", children: "bola", more: "Barcha variantlar rasmlari bilan" },
  en: { title: "Tour options we picked for you:", nights: "nights", adults: "adults", children: "children", more: "All options with photos" },
};

/** Текст для мессенджера: список вариантов и ссылка на страницу с фото */
export function offersText(offers: OfferView[], lang: Lang, url: string | null): string {
  const w = WORDS[lang];
  const lines = [w.title, ""];
  offers.forEach((o, i) => {
    lines.push(`${i + 1}) ${o.hotel}${o.stars ? ` ${"★".repeat(o.stars)}` : ""}${o.destination ? ` — ${o.destination}` : ""}`);
    const trip = [o.dateFrom ? `📅 ${formatDate(`${o.dateFrom}T12:00:00Z`)}` : null, o.nights ? `${o.nights} ${w.nights}` : null, o.adults ? `${o.adults} ${w.adults}` : null, o.children ? `${o.children} ${w.children}` : null].filter(Boolean).join(" · ");
    if (trip) lines.push(trip);
    if (o.meal) lines.push(`🍽 ${o.meal}`);
    lines.push(`💰 ${formatMoney(offerPrice(o), o.currency, lang)}`);
    if (o.note) lines.push(o.note);
    lines.push("");
  });
  if (url) lines.push(`${w.more}: ${url}`);
  return lines.join("\n").trim();
}
