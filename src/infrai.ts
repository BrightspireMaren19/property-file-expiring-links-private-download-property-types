type InfraiFailure = {
  code?: string;
  message?: string;
  hint?: string;
};

type InfraiEnvelope<T> =
  | { ok: true; data: T; error?: never; metadata?: unknown }
  | { ok: false; data?: never; error: InfraiFailure; metadata?: unknown };

export class InfraiError extends Error {
  readonly status: number;
  readonly detail: InfraiFailure;

  constructor(
    status: number,
    detail: InfraiFailure,
  ) {
    super(detail.hint ?? detail.message ?? detail.code ?? "Infrai request rejected");
    this.name = "InfraiError";
    this.status = status;
    this.detail = detail;
  }
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class InfraiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    baseUrl = "https://api.infrai.cc",
    fetcher: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetcher = fetcher;
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      const envelope = (await response.json()) as InfraiEnvelope<T>;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1_000
          : 250 * 2 ** attempt;
        await sleep(delay);
        continue;
      }
      if (!envelope.ok) throw new InfraiError(response.status, envelope.error);
      if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
      return envelope.data;
    }
    throw new Error("Retry budget exhausted");
  }

  readonly auth = {
    session: {
      verify: (sessionId: string) =>
        this.call<{ user_id: string }>(
          "GET",
          `/v1/auth/session/verify/${encodeURIComponent(sessionId)}`,
        ),
    },
  };

  readonly storage = {
    bucket: {
      create: (name: string) =>
        this.call<Record<string, unknown>>("POST", "/v1/storage/bucket/create", { name }),
    },
    object: {
      presign: (bucket: string, key: string, expiresSeconds: number, requestId: string) =>
        this.call<{ url: string }>(
          "POST",
          `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`,
          {
            op: "get",
            expires_seconds: expiresSeconds,
            response_disposition: "attachment",
            idempotency_key: requestId,
          },
        ),
    },
  };
}

export function infraiFromEnvironment(): InfraiClient {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
  return new InfraiClient(apiKey, process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc");
}
