import { describe, expect, it } from "vitest";
import { flightShares, flightWorkers } from "@/lib/salary";
import { activeDelta, FLIGHT_MIN_ACTIVE_SEC, SHIFT_IDLE_MS } from "@/lib/shift";

describe("«В работе»: время работы и доля с авиабилетов", () => {
  it("время с прошлого действия засчитывается, но не больше часа", () => {
    const now = new Date("2026-10-26T10:00:00Z");
    expect(activeDelta(null, now)).toBe(0);
    expect(activeDelta(new Date(now.getTime() - 5 * 60_000), now)).toBe(300);
    expect(activeDelta(new Date(now.getTime() - 3 * SHIFT_IDLE_MS), now)).toBe(3600);
    expect(activeDelta(new Date(now.getTime() + 1000), now)).toBe(0);
  });

  it("с 26.10.2026 в деление входят только те, кто был «В работе» не меньше 4 часов", () => {
    const w = flightWorkers(
      [
        { userId: "a", day: "2026-10-27", activeSec: FLIGHT_MIN_ACTIVE_SEC },
        { userId: "b", day: "2026-10-27", activeSec: FLIGHT_MIN_ACTIVE_SEC - 60 },
        { userId: "c", day: "2026-10-27", activeSec: 8 * 3600 },
      ],
      // действия в CRM без «В работе» после 26.10 не считаются
      [{ userId: "d", day: "2026-10-27" }],
    );
    expect([...(w.get("2026-10-27") ?? [])].sort()).toEqual(["a", "c"]);
    // продавец с коротким днём всё равно получает свою долю; делится на него и тех, кто отработал 4 часа
    const shares = flightShares([{ sellerId: "b", day: "2026-10-27", profit: 900 }], w, 30);
    expect(shares.get("b")).toBe(90);
  });

  it("до 26.10.2026 — по-старому: включал «В работе» или что-то делал в CRM", () => {
    const w = flightWorkers([{ userId: "a", day: "2026-10-20", activeSec: 0 }], [{ userId: "b", day: "2026-10-20" }]);
    expect([...(w.get("2026-10-20") ?? [])].sort()).toEqual(["a", "b"]);
  });
});
