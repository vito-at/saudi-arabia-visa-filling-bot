import { describe, expect, it, vi } from "vitest";
import { GraphClient, GraphError } from "@/lib/meta/graph";
import { signBody, verifySignature } from "@/lib/meta/signature";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("GraphClient", () => {
  it("проходит по всем страницам через paging.next", async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("after=p2")) return json({ data: [{ id: "3" }] });
      return json({ data: [{ id: "1" }, { id: "2" }], paging: { next: "https://graph.facebook.com/v26.0/form/leads?after=p2" } });
    });
    const client = new GraphClient("TOKEN", fetchFn as unknown as typeof fetch);
    const items = await client.all<{ id: string }>("form/leads", { limit: 2 });
    expect(items.map((i) => i.id)).toEqual(["1", "2", "3"]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer TOKEN");
  });

  it("распознаёт истёкший токен", async () => {
    const fetchFn = async () => json({ error: { message: "Error validating access token: Session has expired", type: "OAuthException", code: 190, error_subcode: 463 } }, 400);
    const client = new GraphClient("TOKEN", fetchFn as unknown as typeof fetch);
    const err = (await client.get("me").catch((e: unknown) => e)) as GraphError;
    expect(err).toBeInstanceOf(GraphError);
    expect(err.isTokenError).toBe(true);
    expect(err.message).toContain("Session has expired");
  });

  it("ошибка прав доступа — не ошибка токена", async () => {
    const fetchFn = async () => json({ error: { message: "(#200) Requires leads_retrieval permission", type: "OAuthException", code: 200 } }, 403);
    const err = (await new GraphClient("T", fetchFn as unknown as typeof fetch).get("x").catch((e: unknown) => e)) as GraphError;
    expect(err.isTokenError).toBe(false);
    expect(err.isPermissionError).toBe(true);
  });
});

describe("подпись вебхука X-Hub-Signature-256", () => {
  const secret = "app_secret_123";
  const body = JSON.stringify({ object: "page", entry: [{ id: "1", changes: [{ field: "leadgen", value: { leadgen_id: "42" } }] }] });

  it("принимает корректную подпись", () => {
    expect(verifySignature(body, signBody(body, secret), secret)).toBe(true);
  });
  it("отклоняет подделку, чужой секрет и изменённое тело", () => {
    expect(verifySignature(body, signBody(body, "other"), secret)).toBe(false);
    expect(verifySignature(body + " ", signBody(body, secret), secret)).toBe(false);
    expect(verifySignature(body, "sha256=abc", secret)).toBe(false);
    expect(verifySignature(body, null, secret)).toBe(false);
    expect(verifySignature(body, signBody(body, secret).replace("sha256", "sha1"), secret)).toBe(false);
  });
});
