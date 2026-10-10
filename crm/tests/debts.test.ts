import { describe, expect, it } from "vitest";
import { compareDebts, debtLeft, debtTotals, dueState, parsePaidAtClose, parsePayment } from "@/lib/debts";

describe("долги", () => {
  it("остаток долга не бывает отрицательным", () => {
    expect(debtLeft(1000, 400)).toBe(600);
    expect(debtLeft(1000, 1000)).toBe(0);
    expect(debtLeft(1000, 1200)).toBe(0);
    expect(debtLeft(0.3, 0.1)).toBe(0.2);
  });

  it("оплачено при закрытии: пусто — вся сумма, иначе 0…сумма", () => {
    expect(parsePaidAtClose("", 1500)).toBe(1500);
    expect(parsePaidAtClose(undefined, 1500)).toBe(1500);
    expect(parsePaidAtClose("500", 1500)).toBe(500);
    expect(parsePaidAtClose("1 000 000", 3_000_000)).toBe(1_000_000);
    expect(parsePaidAtClose("0", 1500)).toBe(0);
    expect(parsePaidAtClose("1600", 1500)).toBeNull();
    expect(parsePaidAtClose("-1", 1500)).toBeNull();
    expect(parsePaidAtClose("abc", 1500)).toBeNull();
  });

  it("доплата — больше нуля и не больше долга", () => {
    expect(parsePayment("200,5", 300)).toBe(200.5);
    expect(parsePayment("300", 300)).toBe(300);
    expect(parsePayment("301", 300)).toBeNull();
    expect(parsePayment("0", 300)).toBeNull();
    expect(parsePayment("", 300)).toBeNull();
  });

  it("срок оплаты считается по ташкентским дням", () => {
    const now = new Date("2026-10-10T20:00:00Z"); // 11.10 01:00 в Ташкенте
    expect(dueState(null, now)).toEqual({ kind: "none" });
    expect(dueState(new Date("2026-10-10T19:00:00Z"), now)).toEqual({ kind: "today" }); // 11.10 00:00
    expect(dueState(new Date("2026-10-08T19:00:00Z"), now)).toEqual({ kind: "overdue", days: 2 });
    expect(dueState(new Date("2026-10-14T19:00:00Z"), now)).toEqual({ kind: "upcoming", days: 4 });
  });

  it("сначала просроченные и ближайшие сроки, затем без срока по дате продажи", () => {
    const rows = [
      { id: "noDueOld", dueAt: null, paidAt: new Date("2026-09-01") },
      { id: "later", dueAt: new Date("2026-10-20"), paidAt: new Date("2026-10-01") },
      { id: "noDueNew", dueAt: null, paidAt: new Date("2026-10-05") },
      { id: "overdue", dueAt: new Date("2026-10-01"), paidAt: new Date("2026-09-20") },
    ];
    expect(rows.sort(compareDebts).map((r) => r.id)).toEqual(["overdue", "later", "noDueOld", "noDueNew"]);
  });

  it("итоги по валютам", () => {
    expect(debtTotals([{ currency: "USD", left: 100 }, { currency: "UZS", left: 500_000 }, { currency: "USD", left: 50.5 }])).toEqual({ USD: 150.5, UZS: 500_000 });
  });
});
