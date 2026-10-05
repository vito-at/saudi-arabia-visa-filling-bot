/** Минимальный клиент Meta Graph API с пагинацией и разбором ошибок. */

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v26.0";
const GRAPH_URL = process.env.META_GRAPH_URL || "https://graph.facebook.com";

export class GraphError extends Error {
  constructor(
    message: string,
    public code?: number,
    public subcode?: number,
    public type?: string,
    public status?: number,
  ) {
    super(message);
    this.name = "GraphError";
  }

  /** Токен истёк, отозван или пользователь сменил пароль — нужна замена токена */
  get isTokenError(): boolean {
    return this.code === 190 || this.code === 102 || this.type === "OAuthException" && [463, 467, 460, 458, 459, 464].includes(this.subcode ?? 0);
  }

  /** Недостаточно прав (не выдано разрешение leads_retrieval и т. п.) */
  get isPermissionError(): boolean {
    return this.code === 10 || this.code === 200 || (this.code !== undefined && this.code >= 200 && this.code < 300);
  }
}

export type FetchFn = typeof fetch;

export class GraphClient {
  constructor(
    private token: string,
    private fetchFn: FetchFn = fetch,
    private version = GRAPH_VERSION,
  ) {}

  url(path: string, params: Record<string, string | number | undefined> = {}): string {
    const u = new URL(`${GRAPH_URL}/${this.version}/${path.replace(/^\//, "")}`);
    for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, String(v));
    return u.toString();
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    // токен передаём заголовком, чтобы он не попадал в логи прокси вместе с URL
    const res = await this.fetchFn(url, { ...init, headers: { Authorization: `Bearer ${this.token}`, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(30_000) });
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      throw new GraphError(`Некорректный ответ Graph API (HTTP ${res.status})`, undefined, undefined, undefined, res.status);
    }
    const err = (body as { error?: { message: string; code?: number; error_subcode?: number; type?: string } }).error;
    if (!res.ok || err) {
      throw new GraphError(err?.message ?? `HTTP ${res.status}`, err?.code, err?.error_subcode, err?.type, res.status);
    }
    return body as T;
  }

  get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>(this.url(path, params));
  }

  post<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>(this.url(path, params), { method: "POST" });
  }

  /** POST с JSON-телом (Conversions API); body — уже готовая JSON-строка */
  postJson<T>(path: string, body: string): Promise<T> {
    return this.request<T>(this.url(path), { method: "POST", body, headers: { "Content-Type": "application/json" } });
  }

  /** Обход всех страниц курсора: следуем paging.next, пока он есть */
  async *paginate<T>(path: string, params?: Record<string, string | number | undefined>, maxPages = 200): AsyncGenerator<T> {
    let next: string | undefined = this.url(path, params);
    let pages = 0;
    while (next && pages < maxPages) {
      const page: { data?: T[]; paging?: { next?: string } } = await this.request(next);
      for (const item of page.data ?? []) yield item;
      next = page.paging?.next;
      pages++;
    }
  }

  async all<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T[]> {
    const out: T[] = [];
    for await (const item of this.paginate<T>(path, params)) out.push(item);
    return out;
  }
}
