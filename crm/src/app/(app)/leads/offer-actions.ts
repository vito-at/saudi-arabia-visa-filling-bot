"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runAction } from "@/lib/actions";
import { getLeadForUser } from "@/lib/access";
import { requireUser } from "@/lib/session";
import { ValidationError } from "@/lib/leads/service";
import { parseInputDate } from "@/lib/format";
import { offersText, toOfferView } from "@/lib/offers";
import { sendChatMessage } from "@/lib/chats/send";
import { getI18n } from "@/i18n/server";
import { parseAmount } from "@/lib/money";

export interface OfferInput {
  hotel: string;
  stars: string;
  destination: string;
  meal: string;
  dateFrom: string;
  nights: string;
  adults: string;
  children: string;
  operator: string;
  priceOperator: string;
  markup: string;
  currency: string;
  photoUrl: string;
  link: string;
  note: string;
}

const int = (v: string, max: number) => {
  if (!v.trim()) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > max) throw new ValidationError("err.offerValues");
  return n;
};
const money = (v: string, required: boolean) => {
  if (!v.trim()) {
    if (required) throw new ValidationError("err.offerPrice");
    return 0;
  }
  const n = parseAmount(v);
  if (!Number.isFinite(n) || n < 0) throw new ValidationError("err.offerPrice");
  return n;
};
const url = (v: string) => {
  const s = v.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) throw new ValidationError("err.offerUrl");
  return s.slice(0, 1000);
};

function parse(i: OfferInput) {
  const hotel = i.hotel.trim().slice(0, 200);
  if (!hotel) throw new ValidationError("err.offerHotel");
  return {
    hotel,
    stars: int(i.stars, 5),
    destination: i.destination.trim().slice(0, 200) || null,
    meal: i.meal.trim().slice(0, 100) || null,
    // колонка @db.Date хранит день по UTC
    dateFrom: parseInputDate(i.dateFrom) ? new Date(`${i.dateFrom}T00:00:00Z`) : null,
    nights: int(i.nights, 60),
    adults: int(i.adults, 50),
    children: int(i.children, 50),
    operator: i.operator.trim().slice(0, 100) || null,
    priceOperator: money(i.priceOperator, true),
    markup: money(i.markup, false),
    currency: i.currency === "UZS" ? ("UZS" as const) : ("USD" as const),
    photoUrl: url(i.photoUrl),
    link: url(i.link),
    note: i.note.trim().slice(0, 500) || null,
  };
}

export async function saveOfferAction(leadId: string, input: OfferInput, offerId?: string) {
  return runAction(async () => {
    const user = await requireUser();
    await getLeadForUser(user, leadId);
    const data = parse(input);
    if (offerId) {
      await prisma.tourOffer.updateMany({ where: { id: offerId, leadId }, data });
    } else {
      const last = await prisma.tourOffer.findFirst({ where: { leadId }, orderBy: { order: "desc" }, select: { order: true } });
      await prisma.tourOffer.create({ data: { ...data, leadId, order: (last?.order ?? 0) + 1, createdById: user.id } });
    }
    revalidatePath(`/leads/${leadId}`);
  });
}

export async function deleteOfferAction(leadId: string, offerId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await getLeadForUser(user, leadId);
    await prisma.tourOffer.deleteMany({ where: { id: offerId, leadId } });
    revalidatePath(`/leads/${leadId}`);
  });
}

const base = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

/** Ссылка на подборку для клиента (создаётся при первой отправке) */
async function ensureToken(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, select: { offersToken: true } });
  if (lead.offersToken) return lead.offersToken;
  const token = crypto.randomBytes(9).toString("base64url");
  await prisma.lead.update({ where: { id: leadId }, data: { offersToken: token } });
  return token;
}

/** Текст подборки со ссылкой — скопировать или отправить в чат */
export async function offersMessageAction(leadId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await getLeadForUser(user, leadId);
    const offers = await prisma.tourOffer.findMany({ where: { leadId }, orderBy: { order: "asc" } });
    if (!offers.length) throw new ValidationError("err.offersEmpty");
    const token = await ensureToken(leadId);
    const { locale } = await getI18n();
    const link = `${base()}/o/${token}`;
    return { text: offersText(offers.map(toOfferView), locale, link), link };
  });
}

/** Отправить подборку клиенту в переписку (Instagram / Telegram) */
export async function sendOffersToChatAction(leadId: string, conversationId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await getLeadForUser(user, leadId);
    const conv = await prisma.conversation.findFirst({ where: { id: conversationId, leadId } });
    if (!conv) throw new ValidationError("err.chatNotFound");
    const offers = await prisma.tourOffer.findMany({ where: { leadId }, orderBy: { order: "asc" } });
    if (!offers.length) throw new ValidationError("err.offersEmpty");
    const token = await ensureToken(leadId);
    const { locale } = await getI18n();
    try {
      await sendChatMessage(conversationId, offersText(offers.map(toOfferView), locale, `${base()}/o/${token}`), user.id);
    } catch (e) {
      if (e instanceof ValidationError) throw e;
      throw new ValidationError("err.chatSend", { error: e instanceof Error ? e.message : String(e) });
    }
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/chats");
  });
}
