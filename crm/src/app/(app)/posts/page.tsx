import { PageHeader } from "@/components/layout/page-header";
import { PostGenerator, type PostInitial } from "@/components/posts/post-generator";
import { prisma } from "@/lib/db";
import { leadScope } from "@/lib/access";
import { formatDate } from "@/lib/format";
import { offerPrice, toOfferView } from "@/lib/offers";
import { sp, type SearchParams } from "@/lib/leads/query";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/i18n/server";

/** Генератор постов для Instagram; ?offer=<id> — заполнить из варианта подборки туров */
export default async function PostsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  const { t, f } = await getI18n();
  const offerId = sp(params, "offer");
  const row = offerId ? await prisma.tourOffer.findFirst({ where: { id: offerId, lead: leadScope(user) } }) : null;
  let initial: PostInitial = {};
  if (row) {
    const o = toOfferView(row);
    initial = {
      title: o.destination || o.hotel,
      details: [
        o.destination ? `${o.hotel}${o.stars ? ` ${"★".repeat(o.stars)}` : ""}` : o.stars ? "★".repeat(o.stars) : null,
        [o.dateFrom && t("offers.from", { date: formatDate(`${o.dateFrom}T12:00:00Z`) }), o.nights && t("offers.nightsN", { n: o.nights }), o.meal].filter(Boolean).join(" · "),
      ]
        .filter(Boolean)
        .join("\n"),
      price: f.money(offerPrice(o), o.currency),
      photoUrl: o.photoUrl,
    };
  }
  return (
    <div>
      <PageHeader title={t("posts.pageTitle")} description={t("posts.subtitle")} />
      <PostGenerator initial={initial} />
    </div>
  );
}
