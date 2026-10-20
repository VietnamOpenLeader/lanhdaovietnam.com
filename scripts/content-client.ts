export class ContentApiFailure extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ContentApiFailure";
  }
}

export interface ContentClientOptions {
  readonly baseURL: string;
  readonly token?: string;
  readonly fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export interface ContentClient {
  readonly request: (
    path: string,
    init?: RequestInit,
  ) => Promise<unknown>;
}

const bearerTokenPattern = /^[A-Za-z0-9_-]{43,128}$/u;
const requestTimeoutMs = 15_000;

function isLoopback(hostname: string): boolean {
  return hostname === "localhost"
    || hostname === "::1"
    || hostname === "[::1]"
    || (hostname.split(".").length === 4
      && hostname.split(".")[0] === "127"
      && hostname.split(".").slice(1).every((part) =>
        /^\d{1,3}$/u.test(part) && Number(part) <= 255
      ));
}

function validateBaseURL(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ContentApiFailure("INVALID_RESPONSE");
  }

  const loopback = isLoopback(url.hostname);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
    || url.username !== ""
    || url.password !== ""
    || url.search !== ""
    || url.hash !== ""
    || url.pathname !== "/") {
    throw new ContentApiFailure("INVALID_RESPONSE");
  }
  return url;
}

function validateToken(token?: string): void {
  if (token !== undefined && !bearerTokenPattern.test(token)) {
    throw new ContentApiFailure("INVALID_RESPONSE");
  }
}

function safeErrorCode(body: unknown): string {
  if (typeof body !== "object" || body === null || !("error" in body)) return "API_ERROR";
  const error = body.error;
  if (typeof error !== "object" || error === null || !("code" in error)) return "API_ERROR";
  return typeof error.code === "string" && /^[A-Z_]{1,40}$/u.test(error.code)
    ? error.code
    : "API_ERROR";
}

async function readResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ContentApiFailure("INVALID_RESPONSE");
  }
  if (!response.ok) throw new ContentApiFailure(safeErrorCode(body));
  return body;
}

export function createContentClient(options: ContentClientOptions): ContentClient {
  const baseURL = validateBaseURL(options.baseURL);
  validateToken(options.token);
  const fetcher = options.fetcher ?? fetch;

  return {
    request: async (path, init = {}) => {
      const headers = new Headers(init.headers);
      if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
      let response: Response;
      try {
        response = await fetcher(new URL(path, baseURL), {
          ...init,
          headers,
          redirect: "error",
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
      } catch (error) {
        throw new ContentApiFailure(
          error instanceof Error && error.name === "TimeoutError" ? "TIMEOUT" : "NETWORK",
        );
      }
      return readResponse(response);
    },
  };
}
