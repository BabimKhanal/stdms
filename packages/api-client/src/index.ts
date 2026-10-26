export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export class EduApiClient {
  constructor(private readonly baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1", private readonly getToken: () => string | null = () => null) {}
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
    const payload = (await response.json()) as ApiResult<T>;
    if (!response.ok || !payload.ok) throw new Error(payload.ok ? "Request failed" : payload.error);
    return payload.data;
  }
  get<T>(path: string) { return this.request<T>(path); }
  post<T>(path: string, body: unknown) { return this.request<T>(path, { method: "POST", body: JSON.stringify(body) }); }
  put<T>(path: string, body: unknown) { return this.request<T>(path, { method: "PUT", body: JSON.stringify(body) }); }
  delete<T>(path: string) { return this.request<T>(path, { method: "DELETE" }); }
}
