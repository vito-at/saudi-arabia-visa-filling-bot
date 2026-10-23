import { describe, expect, it } from "vitest";
import { loginBlocked, loginFailed, loginSucceeded } from "@/lib/login-guard";

describe("защита входа от подбора пароля", () => {
  it("после 5 ошибок пара «логин + IP» закрыта на 15 минут, другой IP — нет", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) loginFailed("Admin", "1.1.1.1", t0);
    expect(loginBlocked("admin", "1.1.1.1", t0 + 1000)).toBe(true);
    expect(loginBlocked("admin", "2.2.2.2", t0 + 1000)).toBe(false);
    expect(loginBlocked("admin", "1.1.1.1", t0 + 16 * 60_000)).toBe(false);
  });
  it("успешный вход сбрасывает счётчик", () => {
    for (let i = 0; i < 4; i++) loginFailed("manager", "3.3.3.3");
    loginSucceeded("manager", "3.3.3.3");
    loginFailed("manager", "3.3.3.3");
    expect(loginBlocked("manager", "3.3.3.3")).toBe(false);
  });
});
