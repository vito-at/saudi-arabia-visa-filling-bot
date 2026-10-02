import { describe, expect, it } from "vitest";
import {
  adKey,
  calcFunnel,
  calcKpis,
  calcLossMatrix,
  calcLossReasons,
  calcManagers,
  delta,
  groupLeads,
  timeSeries,
  withSpend,
  type RDeal,
  type RLead,
} from "@/lib/reports/calc";
import { pickRoundRobin } from "@/lib/leads/distribution";

const m = { currency: "USD" as const, rate: 12500 };
const t0 = new Date("2026-09-01T10:00:00+05:00");
const deal = (amount: number, cost: number, currency: "USD" | "UZS" = "USD", managerId = "m1"): RDeal => ({ amount, cost, currency, paidAt: t0, managerId });

let seq = 0;
function lead(p: Partial<RLead>): RLead {
  seq++;
  return {
    id: `l${seq}`,
    createdAt: t0,
    managerId: "m1",
    statusId: "s_new",
    statusKind: "NEW",
    lossReasonId: null,
    campaignId: null,
    campaignName: null,
    adsetId: null,
    adsetName: null,
    adId: null,
    adName: null,
    formId: null,
    formName: null,
    serviceType: null,
    destination: null,
    firstResponseAt: null,
    visitedStatusIds: [],
    deals: [],
    ...p,
  };
}

const statuses = [
  { id: "s_new", name: "Новый", color: "#000", order: 1, kind: "NEW" },
  { id: "s_work", name: "Взят в работу", color: "#000", order: 2, kind: "IN_PROGRESS" },
  { id: "s_offer", name: "Отправлено предложение", color: "#000", order: 3, kind: "OTHER" },
  { id: "s_won", name: "Продано", color: "#000", order: 4, kind: "WON" },
  { id: "s_lost", name: "Отказ", color: "#000", order: 5, kind: "LOST" },
];

describe("KPI дашборда", () => {
  it("конверсия, выручка, прибыль, средний чек", () => {
    const leads = [lead({ statusKind: "WON" }), lead({ statusKind: "WON" }), lead({ statusKind: "LOST" }), lead({})];
    const deals = [deal(1000, 800), deal(12_500_000, 10_000_000, "UZS")];
    expect(calcKpis(leads, deals, m)).toEqual({ leads: 4, sales: 2, conversion: 0.5, revenue: 2000, profit: 400, avgCheck: 1000, deals: 2 });
  });
  it("пустой период", () => {
    expect(calcKpis([], [], m)).toEqual({ leads: 0, sales: 0, conversion: null, revenue: 0, profit: 0, avgCheck: null, deals: 0 });
  });
  it("сравнение с прошлым периодом", () => {
    expect(delta(150, 100)).toBe(0.5);
    expect(delta(50, 100)).toBe(-0.5);
    expect(delta(0, 0)).toBe(0);
    expect(delta(10, 0)).toBeNull();
    expect(delta(null, 5)).toBeNull();
  });
});

describe("воронка", () => {
  it("лид учитывается на всех этапах до максимального пройденного", () => {
    const leads = [
      lead({ statusId: "s_new" }),
      lead({ statusId: "s_work", visitedStatusIds: ["s_new", "s_work"] }),
      lead({ statusId: "s_won", statusKind: "WON", visitedStatusIds: ["s_new", "s_work", "s_offer", "s_won"] }),
      // отказ после предложения: дошёл до «Отправлено предложение»
      lead({ statusId: "s_lost", statusKind: "LOST", visitedStatusIds: ["s_new", "s_work", "s_offer", "s_lost"] }),
      // лид перескочил сразу в продажу — всё равно проходит все этапы до «Продано»
      lead({ statusId: "s_won", statusKind: "WON", visitedStatusIds: ["s_won"] }),
    ];
    const f = calcFunnel(leads, statuses);
    expect(f.total).toBe(5);
    expect(f.lost).toBe(1);
    expect(f.steps.map((s) => [s.name, s.count])).toEqual([
      ["Новый", 5],
      ["Взят в работу", 4],
      ["Отправлено предложение", 3],
      ["Продано", 2],
    ]);
    expect(f.steps[3].ofTotal).toBe(0.4);
    expect(f.steps[3].ofPrev).toBeCloseTo(2 / 3);
  });
});

describe("причины отказов", () => {
  const reasons = [
    { id: "r1", name: "Дорого" },
    { id: "r2", name: "Купил у конкурентов" },
  ];
  const leads = [
    lead({ statusKind: "LOST", lossReasonId: "r1", managerId: "m1", campaignId: "c1" }),
    lead({ statusKind: "LOST", lossReasonId: "r1", managerId: "m2", campaignId: "c1" }),
    lead({ statusKind: "LOST", lossReasonId: "r2", managerId: "m2", campaignId: null }),
    lead({ statusKind: "LOST", lossReasonId: "r1", managerId: "m1", campaignId: "c2" }),
    lead({ statusKind: "WON" }),
  ];
  it("количество и доля от всех отказов", () => {
    const r = calcLossReasons(leads, reasons);
    expect(r.total).toBe(4);
    expect(r.rows).toEqual([
      { reasonId: "r1", name: "Дорого", count: 3, share: 0.75 },
      { reasonId: "r2", name: "Купил у конкурентов", count: 1, share: 0.25 },
    ]);
  });
  it("разбивка по менеджерам и кампаниям", () => {
    const byM = calcLossMatrix(leads, "managerId");
    expect(byM.get("m1")).toEqual({ total: 2, byReason: new Map([["r1", 2]]) });
    expect(byM.get("m2")?.byReason.get("r2")).toBe(1);
    const byC = calcLossMatrix(leads, "campaignId");
    expect(byC.get("none")?.total).toBe(1);
    expect(byC.get("c1")?.total).toBe(2);
  });
});

describe("отчёт по рекламе", () => {
  const leads = [
    lead({ campaignId: "c1", campaignName: "Умра", statusKind: "WON", deals: [deal(2000, 1700)] }),
    lead({ campaignId: "c1", campaignName: "Умра", statusKind: "LOST" }),
    lead({ campaignId: "c1", campaignName: "Умра" }),
    lead({ campaignId: "c1", campaignName: "Умра" }),
    lead({ campaignId: "c2", campaignName: "Дубай", statusKind: "WON", deals: [deal(12_500_000, 11_250_000, "UZS")] }),
    lead({ campaignId: null }), // звонок — не входит
  ];
  it("лиды, продажи, конверсия, выручка, прибыль по кампаниям", () => {
    const rows = groupLeads(leads, adKey("campaign"), m);
    expect(rows).toEqual([
      { key: "c1", name: "Умра", leads: 4, sales: 1, conversion: 0.25, revenue: 2000, profit: 300 },
      { key: "c2", name: "Дубай", leads: 1, sales: 1, conversion: 1, revenue: 1000, profit: 100 },
    ]);
  });
  it("стоимость лида, стоимость продажи и ROI", () => {
    const stat = (spend: number, impressions = 0, clicks = 0, name: string | null = null) => ({ spend, impressions, clicks, name });
    const rows = withSpend(groupLeads(leads, adKey("campaign"), m), new Map([["c1", stat(200)]]));
    expect(rows[0]).toMatchObject({ spend: 200, cpl: 50, cps: 200, roi: 0.5 }); // (300 − 200) / 200
    expect(rows[1]).toMatchObject({ spend: 0, cpl: 0, cps: 0, roi: null }); // нет расхода — ROI не считаем
    expect(withSpend(groupLeads(leads, adKey("campaign"), m), null)[0]).toMatchObject({ spend: null, roi: null });
  });
  it("показы, клики, CTR, цена клика и кампании с расходом без лидов", () => {
    const stats = new Map([
      ["c1", { spend: 200, impressions: 10_000, clicks: 250, name: "Умра (Meta)" }],
      ["c3", { spend: 50, impressions: 4_000, clicks: 40, name: "Стамбул" }],
      ["c4", { spend: 0, impressions: 0, clicks: 0, name: "Пустая" }],
    ]);
    const rows = withSpend(groupLeads(leads, adKey("campaign"), m), stats);
    expect(rows.map((r) => r.key)).toEqual(["c1", "c2", "c3"]); // c4 без расхода и показов не показываем
    expect(rows[0]).toMatchObject({ name: "Умра", impressions: 10_000, clicks: 250, ctr: 0.025, cpc: 0.8 });
    expect(rows[1]).toMatchObject({ spend: 0, impressions: 0, clicks: 0, ctr: null, cpc: null });
    expect(rows[2]).toMatchObject({ name: "Стамбул", leads: 0, sales: 0, spend: 50, cpl: null, ctr: 0.01, cpc: 1.25, roi: -1 });
  });
});

describe("отчёт по менеджерам", () => {
  it("лиды в работе, продажи, конверсия, прибыль, среднее время реакции", () => {
    const leads = [
      lead({ managerId: "m1", statusKind: "WON", firstResponseAt: new Date(t0.getTime() + 10 * 60000) }),
      lead({ managerId: "m1", statusKind: "OTHER", firstResponseAt: new Date(t0.getTime() + 30 * 60000) }),
      lead({ managerId: "m1", statusKind: "LOST" }),
      lead({ managerId: "m2", statusKind: "NEW" }),
    ];
    const deals = [deal(1000, 700, "USD", "m1"), deal(500, 450, "USD", "m2")];
    const rows = calcManagers(leads, deals, [{ id: "m1", name: "Дилшод" }, { id: "m2", name: "Гулнора" }, { id: "m3", name: "Без лидов" }], m);
    expect(rows).toEqual([
      { managerId: "m1", name: "Дилшод", leads: 3, inWork: 1, sales: 1, lost: 1, conversion: 1 / 3, revenue: 1000, profit: 300, avgFirstResponseMin: 20 },
      { managerId: "m2", name: "Гулнора", leads: 1, inWork: 1, sales: 0, lost: 0, conversion: 0, revenue: 500, profit: 50, avgFirstResponseMin: null },
    ]);
  });
});

describe("ряды по дням и распределение", () => {
  it("суммирует по дням, длинные периоды — по неделям", () => {
    const from = new Date("2026-09-01T00:00:00+05:00");
    const to = new Date("2026-09-04T00:00:00+05:00");
    const s = timeSeries([{ date: new Date("2026-09-01T12:00:00+05:00"), value: 1 }, { date: new Date("2026-09-03T23:59:00+05:00"), value: 2 }, { date: to, value: 5 }], from, to);
    expect(s.bucket).toBe(1);
    expect(s.points.map((p) => p.value)).toEqual([1, 0, 2]);
    expect(timeSeries([], from, new Date(from.getTime() + 90 * 86400000)).bucket).toBe(7);
  });
  it("round-robin выбирает менеджера, которому дольше всех не давали лидов", () => {
    const d = (s: string) => new Date(s);
    const pick = pickRoundRobin([
      { id: "a", lastAssignedAt: d("2026-09-30T10:00:00Z"), createdAt: d("2026-01-01") },
      { id: "b", lastAssignedAt: d("2026-09-30T09:00:00Z"), createdAt: d("2026-01-01") },
      { id: "c", lastAssignedAt: null, createdAt: d("2026-02-01") },
    ]);
    expect(pick.id).toBe("c");
    expect(pickRoundRobin([{ id: "a", lastAssignedAt: d("2026-09-30T10:00:00Z"), createdAt: d("2026-01-01") }, { id: "b", lastAssignedAt: d("2026-09-30T09:00:00Z"), createdAt: d("2026-01-01") }]).id).toBe("b");
  });
});
