import { describe, expect, it } from "vitest";
import { createT } from "@/i18n/core";
import { historyValue, reasonName, statusName } from "@/i18n/labels";
import { MESSAGES } from "@/i18n/messages";
import { formatDuration, formatMoney } from "@/lib/format";

type Tree = { [k: string]: string | Tree };
function flatten(o: Tree, prefix = ""): Record<string, string> {
  return Object.entries(o).reduce<Record<string, string>>((acc, [k, v]) => {
    if (typeof v === "string") acc[prefix + k] = v;
    else Object.assign(acc, flatten(v, `${prefix}${k}.`));
    return acc;
  }, {});
}

const ru = flatten(MESSAGES.ru as unknown as Tree);
const uz = flatten(MESSAGES.uz as unknown as Tree);
const en = flatten(MESSAGES.en as unknown as Tree);
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

describe("словари переводов", () => {
  it("во всех языках одинаковые ключи", () => {
    expect(Object.keys(uz).sort()).toEqual(Object.keys(ru).sort());
    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
  });
  it("нет пустых строк и русских букв в узбекском и английском", () => {
    for (const [k, v] of [...Object.entries(uz), ...Object.entries(en)]) {
      expect(v.trim(), k).not.toBe("");
      expect(/[А-Яа-яЁё]/.test(v), `${k}: ${v}`).toBe(false);
    }
  });
  it("подстановки {…} совпадают во всех языках", () => {
    for (const k of Object.keys(ru)) {
      expect(vars(uz[k]), `uz ${k}`).toBe(vars(ru[k]));
      expect(vars(en[k]), `en ${k}`).toBe(vars(ru[k]));
    }
  });
});

describe("перевод и подписи", () => {
  const tUz = createT(MESSAGES.uz);
  const tEn = createT(MESSAGES.en);
  it("подставляет переменные и возвращает ключ, если перевода нет", () => {
    expect(tEn("leads.assigned", { n: 3 })).toBe("Leads assigned: 3");
    expect(tUz("nav.leads")).toBe("Lidlar");
    expect(createT(MESSAGES.en)("такого.ключа.нет" as never)).toBe("такого.ключа.нет");
  });
  it("стандартные статусы и причины показываются на языке пользователя, свои — как есть", () => {
    expect(statusName(tEn, "Продано")).toBe("Sold");
    expect(statusName(tUz, "Не дозвонились")).toBe("Bog‘lanib bo‘lmadi");
    expect(statusName(tEn, "Бронирование")).toBe("Бронирование");
    expect(reasonName(tEn, "Дорого")).toBe("Too expensive");
  });
  it("история изменений: известные значения переводятся", () => {
    expect(historyValue(tEn, "Звонок · повторное обращение")).toBe("Phone call · repeat inquiry");
    expect(historyValue(tEn, "Дилшод (автоматически)")).toBe("Дилшод (automatically)");
    expect(historyValue(tEn, "Дорого — клиент ушёл")).toBe("Too expensive — клиент ушёл");
    expect(historyValue(tUz, "Авиабилеты")).toBe("Aviachiptalar");
  });
  it("суммы и длительности на трёх языках", () => {
    expect(formatMoney(1500000, "UZS", "ru")).toBe("1 500 000 сум");
    expect(formatMoney(1500000, "UZS", "uz")).toBe("1 500 000 so‘m");
    expect(formatMoney(1500000, "UZS", "en")).toBe("1 500 000 UZS");
    expect(formatDuration(75, "en")).toBe("1 h 15 min");
    expect(formatDuration(75, "uz")).toBe("1 soat 15 daq");
  });
});
