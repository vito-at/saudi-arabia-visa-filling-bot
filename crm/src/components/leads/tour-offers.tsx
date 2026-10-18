"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Copy, ExternalLink, Hotel, ImagePlus, Pencil, Plus, Send, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { deleteOfferAction, offersMessageAction, saveOfferAction, sendOffersToChatAction, type OfferInput } from "@/app/(app)/leads/offer-actions";
import { offerPrice, type OfferView } from "@/lib/offers";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/i18n/client";

export interface OfferChat {
  id: string;
  channel: "TELEGRAM" | "INSTAGRAM";
  blocked: boolean;
}

const EMPTY: OfferInput = {
  hotel: "",
  stars: "",
  destination: "",
  meal: "",
  dateFrom: "",
  nights: "",
  adults: "",
  children: "",
  operator: "",
  priceOperator: "",
  markup: "",
  currency: "USD",
  photoUrl: "",
  link: "",
  note: "",
};

const toInput = (o: OfferView): OfferInput => {
  const s = (v: number | string | null) => (v === null ? "" : String(v));
  return {
    hotel: o.hotel,
    stars: s(o.stars),
    destination: s(o.destination),
    meal: s(o.meal),
    dateFrom: s(o.dateFrom),
    nights: s(o.nights),
    adults: s(o.adults),
    children: s(o.children),
    operator: s(o.operator),
    priceOperator: String(o.priceOperator),
    markup: String(o.markup),
    currency: o.currency,
    photoUrl: s(o.photoUrl),
    link: s(o.link),
    note: s(o.note),
  };
};

function OfferDialog({ leadId, offer, onClose }: { leadId: string; offer: OfferView | null; onClose: () => void }) {
  const { t, f } = useI18n();
  const [v, setV] = useState<OfferInput>(offer ? toInput(offer) : EMPTY);
  const [pending, start] = useTransition();
  const set = (k: keyof OfferInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const num = (s: string) => Number(s.replace(/\s/g, "").replace(",", ".")) || 0;
  const client = offerPrice({ priceOperator: num(v.priceOperator), markup: num(v.markup) });

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveOfferAction(leadId, v, offer?.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("common.saved"));
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("offers.editTitle")} className="max-w-2xl">
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7rem] [&>*]:min-w-0">
            <Field label={t("offers.hotel")}>
              <Input value={v.hotel} onChange={set("hotel")} required autoFocus />
            </Field>
            <Field label={t("offers.stars")}>
              <NativeSelect value={v.stars} onChange={set("stars")}>
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
            <Field label={t("offers.destination")}>
              <Input value={v.destination} onChange={set("destination")} />
            </Field>
            <Field label={t("offers.meal")}>
              <Input value={v.meal} onChange={set("meal")} placeholder="BB / HB / AI / UAI" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 [&>*]:min-w-0">
            <Field label={t("offers.dateFrom")}>
              <Input type="date" value={v.dateFrom} onChange={set("dateFrom")} />
            </Field>
            <Field label={t("offers.nights")}>
              <Input type="number" min={0} max={60} value={v.nights} onChange={set("nights")} />
            </Field>
            <Field label={t("offers.adults")}>
              <Input type="number" min={0} max={50} value={v.adults} onChange={set("adults")} />
            </Field>
            <Field label={t("offers.children")}>
              <Input type="number" min={0} max={50} value={v.children} onChange={set("children")} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 [&>*]:min-w-0">
            <Field label={t("offers.operator")}>
              <Input value={v.operator} onChange={set("operator")} />
            </Field>
            <Field label={t("offers.priceOperator")}>
              <Input inputMode="decimal" value={v.priceOperator} onChange={set("priceOperator")} required />
            </Field>
            <Field label={t("offers.markup")}>
              <Input inputMode="decimal" value={v.markup} onChange={set("markup")} />
            </Field>
            <Field label={t("deal.currency")}>
              <NativeSelect value={v.currency} onChange={set("currency")}>
                <option value="USD">{t("currency.USD")}</option>
                <option value="UZS">{t("currency.UZS")}</option>
              </NativeSelect>
            </Field>
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
            {t("offers.clientPrice")}: <b className="tabular-nums">{f.money(client, v.currency === "UZS" ? "UZS" : "USD")}</b>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
            <Field label={t("offers.photoUrl")}>
              <Input type="url" value={v.photoUrl} onChange={set("photoUrl")} placeholder="https://" />
            </Field>
            <Field label={t("offers.link")}>
              <Input type="url" value={v.link} onChange={set("link")} placeholder="https://" />
            </Field>
          </div>
          <Field label={t("offers.note")}>
            <Textarea value={v.note} onChange={set("note")} rows={2} maxLength={500} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Подборка туров в карточке лида: варианты отелей с ценой клиенту, отправка ссылкой или в переписку */
export function TourOffers({ leadId, offers, chats, pageUrl }: { leadId: string; offers: OfferView[]; chats: OfferChat[]; pageUrl: string | null }) {
  const { t, f } = useI18n();
  const [edit, setEdit] = useState<OfferView | "new" | null>(null);
  const [pending, start] = useTransition();

  function copy() {
    start(async () => {
      const res = await offersMessageAction(leadId);
      if (!res.ok || !res.data) return void toast.error(res.ok ? t("common.errorGeneric") : res.error);
      try {
        await navigator.clipboard.writeText(res.data.text);
        toast.success(t("offers.copied"));
      } catch {
        // буфер обмена недоступен (http, старый браузер) — показываем ссылку
        toast.info(res.data.link, { duration: 15_000 });
      }
    });
  }
  function send(c: OfferChat) {
    start(async () => {
      const res = await sendOffersToChatAction(leadId, c.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(t("offers.sent"));
    });
  }
  function remove(o: OfferView) {
    if (!confirm(t("offers.deleteConfirm", { hotel: o.hotel }))) return;
    start(async () => {
      const res = await deleteOfferAction(leadId, o.id);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Hotel className="size-4 text-muted-foreground" /> {t("offers.title")}
          {offers.length > 0 && <span className="text-xs font-normal text-muted-foreground">{offers.length}</span>}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setEdit("new")}>
          <Plus /> {t("offers.add")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {!offers.length && <p className="text-sm text-muted-foreground">{t("offers.empty")}</p>}
        {offers.map((o) => (
          <div key={o.id} className="flex gap-3 rounded-lg border p-2.5">
            {o.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- фото с сайтов туроператоров, домены заранее неизвестны
              <img src={o.photoUrl} alt="" className="size-16 shrink-0 rounded-md bg-muted object-cover" loading="lazy" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Hotel className="size-6" />
              </div>
            )}
            <div className="min-w-0 flex-1 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium break-words">
                    {o.hotel}
                    {o.stars ? (
                      <span className="ml-1.5 inline-flex align-middle text-amber-500">
                        {Array.from({ length: o.stars }, (_, i) => (
                          <Star key={i} className="size-3 fill-current" />
                        ))}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[o.destination, o.dateFrom && formatDate(`${o.dateFrom}T12:00:00Z`), o.nights && t("offers.nightsN", { n: o.nights }), o.meal, o.adults && t("offers.adultsN", { n: o.adults }), o.children && t("offers.childrenN", { n: o.children }), o.operator]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div className="flex shrink-0">
                  <Button size="icon-sm" variant="ghost" title={t("posts.fromOffer")} asChild>
                    <Link href={`/posts?offer=${o.id}`}>
                      <ImagePlus />
                    </Link>
                  </Button>
                  <Button size="icon-sm" variant="ghost" title={t("common.edit")} onClick={() => setEdit(o)}>
                    <Pencil />
                  </Button>
                  <Button size="icon-sm" variant="ghost" title={t("common.delete")} onClick={() => remove(o)} disabled={pending}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                <b className="tabular-nums">{f.money(offerPrice(o), o.currency)}</b>
                {o.markup > 0 && <span className="text-xs text-emerald-700 dark:text-emerald-400">{t("offers.profit", { amount: f.money(o.markup, o.currency) })}</span>}
              </div>
            </div>
          </div>
        ))}
        {offers.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={copy} disabled={pending}>
              <Copy /> {t("offers.copy")}
            </Button>
            {chats.map((c) => (
              <Button key={c.id} size="sm" variant="outline" onClick={() => send(c)} disabled={pending || c.blocked} title={c.blocked ? t("chats.igWindow") : undefined}>
                <Send /> {t("offers.sendTo", { channel: c.channel === "INSTAGRAM" ? "Instagram" : "Telegram" })}
              </Button>
            ))}
            {pageUrl && (
              <a href={pageUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-accent">
                <ExternalLink className="size-4" /> {t("offers.openPage")}
              </a>
            )}
          </div>
        )}
      </CardContent>
      {edit && <OfferDialog leadId={leadId} offer={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </Card>
  );
}
