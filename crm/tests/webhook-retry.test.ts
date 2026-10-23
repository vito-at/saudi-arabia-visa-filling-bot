import { describe, expect, it } from "vitest";
import { retryDelivery } from "@/lib/chats/retry";

describe("повтор доставки вебхука", () => {
  it("первые три сбоя — просим повторить, дальше принимаем, чтобы не застопорить очередь", () => {
    expect([1, 2, 3, 4].map(() => retryDelivery("tg:1"))).toEqual([true, true, true, false]);
    expect(retryDelivery("tg:2")).toBe(true);
  });
});
