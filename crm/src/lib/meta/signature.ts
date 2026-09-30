import crypto from "node:crypto";

/** Проверка подписи вебхука Meta: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(appSecret, rawBody) */
export function verifySignature(rawBody: string | Buffer, header: string | null | undefined, appSecret: string): boolean {
  if (!header || !appSecret) return false;
  const [algo, sig] = header.split("=");
  if (algo !== "sha256" || !sig || !/^[0-9a-f]{64}$/i.test(sig)) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest();
  const received = Buffer.from(sig, "hex");
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export function signBody(rawBody: string, appSecret: string): string {
  return `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
}
