import { describe, expect, it } from "vitest";
import { isRegularClient } from "@/lib/constants";

describe("постоянный клиент", () => {
  it("от 3 сделок", () => {
    expect(isRegularClient(2)).toBe(false);
    expect(isRegularClient(3)).toBe(true);
    expect(isRegularClient(7)).toBe(true);
  });
});
