import test from "node:test";
import assert from "node:assert/strict";

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "1";
const tenantAIdentifier = process.env.TEST_TENANT_A_IDENTIFIER;
const tenantAPassword = process.env.TEST_TENANT_A_PASSWORD;
const tenantBIdentifier = process.env.TEST_TENANT_B_IDENTIFIER;
const tenantBPassword = process.env.TEST_TENANT_B_PASSWORD;

type Envelope<T> = { ok: boolean; data?: T; error?: string };
type Session = { accessToken: string; user: { orgId: string | null } };
type Row = { id: string };

async function login(app: { request: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response> }, identifier: string, password: string) {
  const response = await app.request("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  assert.equal(response.status, 200, await response.text());
  const payload = await response.json() as Envelope<Session>;
  assert.equal(payload.ok, true);
  return payload.data!;
}

async function get<T>(app: { request: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response> }, token: string, path: string) {
  const response = await app.request(path, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await response.json() as Envelope<T>;
  return { response, payload };
}

test("tenant isolation blocks cross-tenant records", { skip: !integrationEnabled || !tenantAIdentifier || !tenantAPassword || !tenantBIdentifier || !tenantBPassword }, async () => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required");
  assert.ok(process.env.APP_DATABASE_URL, "APP_DATABASE_URL is required");
  assert.ok(process.env.REDIS_URL, "REDIS_URL is required");

  const { app } = await import("../src/app.js");
  const tenantA = await login(app, tenantAIdentifier!, tenantAPassword!);
  const tenantB = await login(app, tenantBIdentifier!, tenantBPassword!);
  assert.notEqual(tenantA.user.orgId, tenantB.user.orgId, "fixtures must belong to different organisations");

  const studentsB = await get<Row[]>(app, tenantB.accessToken, "/api/v1/students?page=1&pageSize=2");
  assert.equal(studentsB.response.status, 200);
  const studentB = studentsB.payload.data?.[0];
  assert.ok(studentB, "tenant B needs one student fixture");

  const studentFromA = await get<Row>(app, tenantA.accessToken, `/api/v1/students/${studentB.id}`);
  assert.equal(studentFromA.response.status, 404);
  assert.equal(studentFromA.payload.ok, false);

  const invoicesB = await get<Row[]>(app, tenantB.accessToken, "/api/v1/fees/invoices");
  assert.equal(invoicesB.response.status, 200);
  const invoiceB = invoicesB.payload.data?.[0];
  if (invoiceB) {
    const invoiceFromA = await get<Row>(app, tenantA.accessToken, `/api/v1/fees/invoices/${invoiceB.id}`);
    assert.equal(invoiceFromA.response.status, 404);
    const refundFromA = await app.request(`/api/v1/fees/payments/not-a-payment/refund`, { method: "POST", headers: { Authorization: `Bearer ${tenantA.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ amount: 1 }) });
    assert.ok([403, 404].includes(refundFromA.status));
  }

  const homeworkB = await get<Row[]>(app, tenantB.accessToken, "/api/v1/homework");
  assert.equal(homeworkB.response.status, 200);
  const homeworkFromA = await get<Row[]>(app, tenantA.accessToken, "/api/v1/homework");
  assert.equal(homeworkFromA.response.status, 200);
  if (homeworkB.payload.data?.length) {
    assert.equal(homeworkFromA.payload.data.some((row) => homeworkB.payload.data!.some((other) => other.id === row.id)), false);
  }

  const examsB = await get<Row[]>(app, tenantB.accessToken, "/api/v1/exams");
  assert.equal(examsB.response.status, 200);
  const examB = examsB.payload.data?.[0];
  if (examB) {
    const resultsFromA = await get<Row[]>(app, tenantA.accessToken, `/api/v1/exams/results?examId=${examB.id}`);
    assert.ok([200, 404].includes(resultsFromA.response.status));
    if (resultsFromA.response.status === 200) assert.equal(resultsFromA.payload.data?.length ?? 0, 0);
  }
});
