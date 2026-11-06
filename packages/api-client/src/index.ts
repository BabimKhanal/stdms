export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const SESSION_EXPIRED_EVENT = "edu:session-expired";

export function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  // Native clients pass their configured API URL explicitly. Web requests use
  // the Next.js proxy so the browser only needs to reach the web origin.
  return typeof window !== "undefined" && window.location ? "/api/v1" : "http://localhost:4000/api/v1";
}

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
  constructor(private readonly baseUrl = getApiBaseUrl(), private readonly getToken: () => string | null = () => null) {}
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
    } catch (error) {
      if (init.signal?.aborted) throw error;
      throw new ApiError("We couldn't reach the school service. Check your connection and try again.", 0, "network_error");
    }
    // Only authenticated requests can expire a session, including when an
    // upstream proxy returns an unexpected response body.
    if (response.status === 401 && token) notifySessionExpired();
    let payload: ApiResult<T> & { code?: string };
    try {
      payload = await response.json();
      if (!payload || typeof payload.ok !== "boolean") throw new Error("Invalid API response");
    } catch {
      throw new ApiError(
        response.status >= 500
          ? "The school service is temporarily unavailable. Please try again shortly."
          : "The school service returned an unexpected response. Please try again or contact your administrator.",
        response.ok ? 502 : response.status,
        "api_unavailable",
      );
    }
    if (!response.ok || !payload.ok) {
      // Only an authenticated request can expire. Public login/reset failures
      // must stay on their form instead of causing a redirect loop.
      throw new ApiError(payload.ok ? "Request failed" : payload.error, response.status, payload.code);
    }
    return payload.data;
  }
  get<T>(path: string) { return this.request<T>(path); }
  post<T>(path: string, body: unknown) { return this.request<T>(path, { method: "POST", body: JSON.stringify(body) }); }
  put<T>(path: string, body: unknown) { return this.request<T>(path, { method: "PUT", body: JSON.stringify(body) }); }
  delete<T>(path: string) { return this.request<T>(path, { method: "DELETE" }); }
}
