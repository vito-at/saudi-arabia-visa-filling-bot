import { prisma } from "@/lib/db";

/**
 * Визовые продажи закрываются без себестоимости: расходы на визы учитываются в расходах компании.
 * Если тип услуги лида поменяли на «Визовая поддержка» уже после закрытия сделки (менеджер выбрал в сделке другой продукт),
 * его сделки, ждущие себестоимость, закрываются так же. Возвращает число закрытых сделок.
 */
export async function confirmVisaDeals(leadId: string): Promise<number> {
  // только визовые сделки (или старые без типа): тур или «Другое» визового клиента по-прежнему ждут себестоимость
  const { count } = await prisma.deal.updateMany({ where: { leadId, costConfirmed: false, OR: [{ serviceType: "VISA" }, { serviceType: null }] }, data: { costConfirmed: true } });
  return count;
}
