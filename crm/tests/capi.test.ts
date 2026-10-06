import { describe, expect, it } from "vitest";
import { buildCapiPayload, checkCapi, conversionEventsFor } from "@/lib/meta/capi";

describe("Conversions API: какие события отправлять", () => {
  it("этап воронки — Qualified, попытки дозвона — ничего", () => {
    expect(conversionEventsFor({ kind: "OTHER", inFunnel: true })).toEqual(["Qualified"]); // «Консультация»
    expect(conversionEventsFor({ kind: "IN_PROGRESS", inFunnel: true })).toEqual(["Qualified"]);
    expect(conversionEventsFor({ kind: "OTHER", inFunnel: false })).toEqual([]); // «Не дозвонились»
    expect(conversionEventsFor({ kind: "CALLBACK", inFunnel: false })).toEqual([]); // «Перезвонить»
    expect(conversionEventsFor({ kind: "NEW", inFunnel: true })).toEqual([]);
  });
  it("продажа — Qualified и Converted, отказ — Disqualified", () => {
    expect(conversionEventsFor({ kind: "WON", inFunnel: true })).toEqual(["Qualified", "Converted"]);
    expect(conversionEventsFor({ kind: "LOST", inFunnel: true })).toEqual(["Disqualified"]);
  });
});

describe("Conversions API: тело запроса", () => {
  it("lead_id — число без потери точности, сумма продажи в USD, код тестовых событий", () => {
    const body = buildCapiPayload(
      [
        { leadgenId: "9876543210123456", eventName: "Converted", eventTime: new Date("2026-10-05T10:00:00Z"), value: 1250.5 },
        { leadgenId: "1234567890123456", eventName: "Qualified", eventTime: new Date("2026-10-05T10:00:00Z"), value: null },
      ],
      "TEST123",
    );
    expect(body).toContain('"lead_id":9876543210123456');
    const parsed = JSON.parse(body);
    expect(parsed.test_event_code).toBe("TEST123");
    expect(parsed.data[0]).toMatchObject({
      action_source: "system_generated",
      event_name: "Converted",
      event_time: 1791194400,
      custom_data: { event_source: "crm", lead_event_source: "Orient Travel CRM", value: 1250.5, currency: "USD" },
    });
    expect(parsed.data[1].custom_data.value).toBeUndefined();
  });
  it("без кода тестовых событий поле не передаётся", () => {
    expect(JSON.parse(buildCapiPayload([], null))).toEqual({ data: [] });
  });
});

describe("Conversions API: проверка маркера", () => {
  const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  it("маркер с правом только на отправку (Missing Permission) — не ошибка", async () => {
    const f = reply(400, { error: { message: "(#100) Missing Permission", code: 100, type: "OAuthException" } });
    await expect(checkCapi({ datasetId: "1", token: "t" }, f)).resolves.toEqual({ ok: true, name: null, writeOnly: true });
  });
  it("набор доступен — возвращаем название", async () => {
    await expect(checkCapi({ datasetId: "1", token: "t" }, reply(200, { id: "1", name: "Orient Travel Leads" }))).resolves.toEqual({ ok: true, name: "Orient Travel Leads" });
  });
  it("недействительный маркер — ошибка", async () => {
    const f = reply(400, { error: { message: "Invalid OAuth access token", code: 190, type: "OAuthException" } });
    await expect(checkCapi({ datasetId: "1", token: "t" }, f)).rejects.toThrow(/Invalid OAuth/);
  });
});
