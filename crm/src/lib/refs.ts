import { cache } from "react";
import { prisma } from "./db";

export const getStatuses = cache(() => prisma.leadStatus.findMany({ orderBy: { order: "asc" } }));
export const getLossReasons = cache(() => prisma.lossReason.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }));
export const getManagers = cache(() =>
  prisma.user.findMany({ where: { isActive: true }, orderBy: [{ role: "asc" }, { name: "asc" }], select: { id: true, name: true, role: true } }),
);
export const getSettings = cache(async () => {
  const s = await prisma.appSettings.findUnique({ where: { id: 1 } });
  return s ?? (await prisma.appSettings.create({ data: { id: 1 } }));
});

/** Кампании и формы, встречающиеся в лидах — для фильтров */
export const getAdFilters = cache(async () => {
  const [campaigns, forms] = await Promise.all([
    prisma.lead.groupBy({ by: ["campaignId", "campaignName"], where: { campaignId: { not: null } }, orderBy: { campaignName: "asc" } }),
    prisma.lead.groupBy({ by: ["formId", "formName"], where: { formId: { not: null } }, orderBy: { formName: "asc" } }),
  ]);
  return {
    campaigns: campaigns.map((c) => ({ id: c.campaignId!, name: c.campaignName ?? c.campaignId! })),
    forms: forms.map((f) => ({ id: f.formId!, name: f.formName ?? f.formId! })),
  };
});
