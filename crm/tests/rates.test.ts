import { describe, expect, it } from "vitest";
import { fetchIpakYuliRate, parseUsdRates } from "@/lib/rates";

describe("parseUsdRates — курс из открытых страниц", () => {
  it("таблица HTML с неразрывными пробелами", () => {
    const html = `<table><tr><th>Валюта</th><th>Покупка</th><th>Продажа</th></tr>
      <tr><td><img src="usd.svg"> USD</td><td>12&nbsp;640,00</td><td>12&nbsp;720,00</td></tr>
      <tr><td>EUR</td><td>13 900,00</td><td>14 150,00</td></tr></table>`;
    expect(parseUsdRates(html)).toEqual({ buy: 12640, sell: 12720 });
  });
  it("карточки с текстом «Доллар США»", () => {
    const html = `<div class="rate"><span>Доллар США</span><div>Покупка <b>12 650</b></div><div>Продажа <b>12 730</b></div></div>`;
    expect(parseUsdRates(html)).toEqual({ buy: 12650, sell: 12730 });
  });
  it("JSON-ответ", () => {
    const json = JSON.stringify([{ code: "USD", buy: "12650.00", sell: "12740.00" }, { code: "EUR", buy: "13900", sell: "14100" }]);
    expect(parseUsdRates(json)).toEqual({ buy: 12650, sell: 12740 });
  });
  it("пропускает упоминания USD без курсов и не путает с посторонними числами", () => {
    const html = `<p>Курсы USD обновляются ежедневно, телефон 1296</p><p>ЦБ: USD 12 600,00</p><table><tr><td>USD</td><td>12 655</td><td>12 745</td></tr></table>`;
    expect(parseUsdRates(html)).toEqual({ buy: 12655, sell: 12745 });
  });
  it("нет курса — null", () => {
    expect(parseUsdRates("<html><body>Страница не найдена</body></html>")).toBeNull();
  });
  it("перебирает источники, пока не найдёт курс", async () => {
    process.env.IPAK_RATE_URLS = "https://a.example/rates,https://b.example/rates";
    const fetchFn = (async (url: string) =>
      url.startsWith("https://a.") ? new Response("down", { status: 503 }) : new Response("<td>USD</td><td>12 650</td><td>12 730</td>")) as unknown as typeof fetch;
    const r = await fetchIpakYuliRate(fetchFn);
    expect(r).toEqual({ buy: 12650, sell: 12730, source: "https://b.example/rates" });
    delete process.env.IPAK_RATE_URLS;
  });
});
