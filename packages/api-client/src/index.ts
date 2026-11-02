export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const SESSION_EXPIRED_EVENT = "edu:session-expired";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

function notifySessionExpired() {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

export class EduApiClient {
  constructor(private readonly baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1", private readonly getToken: () => string | null = () => null) {}
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
    const payload = (await response.json()) as ApiResult<T> & { code?: string };
    if (!response.ok || !payload.ok) {
      // Only an authenticated request can expire. Public login/reset failures
      // must stay on their form instead of causing a redirect loop.
      if (response.status === 401 && token) notifySessionExpired();
      throw new ApiError(payload.ok ? "Request failed" : payload.error, response.status, payload.code);
    }
    return payload.data;
  }
  get<T>(path: string) { return this.request<T>(path); }
  post<T>(path: string, body: unknown) { return this.request<T>(path, { method: "POST", body: JSON.stringify(body) }); }
  put<T>(path: string, body: unknown) { return this.request<T>(path, { method: "PUT", body: JSON.stringify(body) }); }
  delete<T>(path: string) { return this.request<T>(path, { method: "DELETE" }); }
}
