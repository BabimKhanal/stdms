import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { ApiError, EduApiClient, getApiBaseUrl, SESSION_EXPIRED_EVENT } from "../../../packages/api-client/src/index";

function browser(t: TestContext) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const events: string[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "http://localhost:3000" }, dispatchEvent: (event: Event) => { events.push(event.type); return true; } } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "window", previous); else Reflect.deleteProperty(globalThis, "window"); });
  return events;
}

test("browser requests default to the same-origin API and preserve login bodies", async (t) => {
  browser(t);
  const previous = process.env.NEXT_PUBLIC_API_URL;
  delete process.env.NEXT_PUBLIC_API_URL;
  t.after(() => { if (previous === undefined) delete process.env.NEXT_PUBLIC_API_URL; else process.env.NEXT_PUBLIC_API_URL = previous; });
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "/api/v1/auth/login");
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(String(init.body)), { identifier: "school-user", password: "test-only" });
    return Response.json({ ok: true, data: { accessToken: "test-token" } });
  });
  assert.equal(getApiBaseUrl(), "/api/v1");
  assert.deepEqual(await new EduApiClient().post("/auth/login", { identifier: "school-user", password: "test-only" }), { accessToken: "test-token" });
});

test("explicit API URLs normalize trailing slashes and keep bearer authentication", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://api.example.test/api/v1/auth/me");
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer test-token");
    return Response.json({ ok: true, data: { id: "user" } });
  });
  assert.deepEqual(await new EduApiClient("https://api.example.test/api/v1/", () => "test-token").get("/auth/me"), { id: "user" });
});

test("network errors are actionable and do not imply invalid credentials", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(new EduApiClient("/api/v1").post("/auth/login", {}), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 0);
    assert.equal(error.code, "network_error");
    assert.match(error.message, /couldn't reach the school service/);
    return true;
  });
});

test("non-JSON gateway errors become a service availability error", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("<h1>Bad gateway</h1>", { status: 502 }));
  await assert.rejects(new EduApiClient("/api/v1").post("/auth/login", {}), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 502);
    assert.equal(error.code, "api_unavailable");
    assert.match(error.message, /temporarily unavailable/);
    return true;
  });
});

test("rejected public login stays on its form but authenticated 401 expires the session", async (t) => {
  const events = browser(t);
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: false, error: "Invalid credentials", code: "unauthenticated" }, { status: 401 }));
  await assert.rejects(new EduApiClient("/api/v1").post("/auth/login", {}), /Invalid credentials/);
  assert.deepEqual(events, []);
  await assert.rejects(new EduApiClient("/api/v1", () => "test-token").get("/auth/me"), /Invalid credentials/);
  assert.deepEqual(events, [SESSION_EXPIRED_EVENT]);
});
