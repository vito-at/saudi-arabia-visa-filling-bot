import type { Metadata } from "next";
import { CalendarDays, ExternalLink, Hotel, Moon, Star, Users, Utensils } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { offerPrice, toOfferView } from "@/lib/offers";
import { getI18n } from "@/i18n/server";

export const metadata: Metadata = { title: "Orient Travel", robots: { index: false, follow: false } };

/**
 * Публичная страница подборки туров для клиента (без входа в CRM). Адрес — случайный токен лида.
 * Показывается только цена клиенту: цена туроператора и наценка не раскрываются.
 */
export default async function OffersPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t, f } = await getI18n();
  const lead = /^[\w-]{8,32}$/.test(token)
    ? await prisma.lead.findUnique({
        where: { offersToken: token },
        select: { name: true, manager: { select: { name: true } }, offers: { orderBy: { order: "asc" } } },
      })
    : null;
  const offers = lead?.offers.map(toOfferView) ?? [];
  const firstName = lead?.name.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Logo className="h-10" />
          <div className="w-44">
            <LanguageSwitcher />
          </div>
        </div>
        {!offers.length ? (
          <p className="py-16 text-center text-muted-foreground">{t("offers.pageNotFound")}</p>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{t("offers.pageTitle")}</h1>
            {firstName && <p className="mt-1 text-sm text-muted-foreground">{t("offers.pageFor", { name: firstName })}</p>}
            <div className="mt-6 space-y-4">
              {offers.map((o, i) => (
                <article key={o.id} className="overflow-hidden rounded-xl border bg-card shadow-xs sm:flex">
                  {o.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- фото с сайтов туроператоров, домены заранее неизвестны
                    <img src={o.photoUrl} alt={o.hotel} className="aspect-video w-full bg-muted object-cover sm:aspect-auto sm:w-64 sm:shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center bg-muted text-muted-foreground sm:aspect-auto sm:w-64 sm:shrink-0">
                      <Hotel className="size-10" />
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                    <div>
                      <div className="text-xs text-muted-foreground">#{i + 1}</div>
                      <h2 className="text-lg font-semibold break-words">{o.hotel}</h2>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {o.stars ? (
                          <span className="inline-flex text-amber-500">
                            {Array.from({ length: o.stars }, (_, k) => (
                              <Star key={k} className="size-4 fill-current" />
                            ))}
                          </span>
                        ) : null}
                        {o.destination}
                      </div>
                    </div>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {o.dateFrom && (
                        <li className="inline-flex items-center gap-1.5">
                          <CalendarDays className="size-4 text-muted-foreground" /> {t("offers.from", { date: formatDate(`${o.dateFrom}T12:00:00Z`) })}
                        </li>
                      )}
                      {o.nights ? (
                        <li className="inline-flex items-center gap-1.5">
                          <Moon className="size-4 text-muted-foreground" /> {t("offers.nightsN", { n: o.nights })}
                        </li>
                      ) : null}
                      {o.meal && (
                        <li className="inline-flex items-center gap-1.5">
                          <Utensils className="size-4 text-muted-foreground" /> {o.meal}
                        </li>
                      )}
                      {o.adults || o.children ? (
                        <li className="inline-flex items-center gap-1.5">
                          <Users className="size-4 text-muted-foreground" />
                          {[o.adults ? t("offers.adultsN", { n: o.adults }) : null, o.children ? t("offers.childrenN", { n: o.children }) : null].filter(Boolean).join(", ")}
                        </li>
                      ) : null}
                    </ul>
                    {o.note && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{o.note}</p>}
                    <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-1">
                      <div>
                        <div className="text-2xl font-bold tabular-nums">{f.money(offerPrice(o), o.currency)}</div>
                        <div className="text-xs text-muted-foreground">{t("offers.pricePer")}</div>
                      </div>
                      {o.link && (
                        <a href={o.link} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                          {t("offers.pageDetails")} <ExternalLink className="size-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-8 rounded-lg bg-muted/50 p-4 text-center text-sm">
              {t("offers.pageContact")}
              {lead?.manager && <span className="mt-1 block font-medium">{lead.manager.name} · Orient Travel</span>}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
