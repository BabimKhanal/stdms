import assert from "node:assert/strict";
import test, { after } from "node:test";
import { app } from "../src/app";
import { appPool, ownerPool } from "../src/db/client";
import { redis } from "../src/lib/redis";
import type { DB } from "../src/lib/types";
import { callbackTransactionUuid, verifyEsewa } from "../src/modules/fees/esewa";
import { addPayment, applyDiscount, completeEsewa, reviewPaymentSubmission } from "../src/modules/fees/service";

// These tests exercise handlers and service guards without external services.
redis.disconnect();
after(async () => { await appPool.end(); await ownerPool.end(); });

test("public payment callbacks bypass institution authentication while finance stays protected", async (t) => {
  t.mock.method(appPool, "connect", async () => ({ query: async () => ({ rows: [] }), release() {} }));
  const cancelled = await app.request("/api/v1/payments/esewa/failure");
  assert.equal(cancelled.status, 302);
  assert.equal(new URL(cancelled.headers.get("location")!).searchParams.get("payment"), "cancelled");
  const missingReference = await app.request("/api/v1/payments/esewa/success");
  assert.equal(missingReference.status, 302);
  assert.equal(new URL(missingReference.headers.get("location")!).searchParams.get("payment"), "failed");
  const invoices = await app.request("/api/v1/fees/invoices");
  assert.equal(invoices.status, 401);
});

test("eSewa v2 callback resolves encoded data and rejects malformed payloads", () => {
  const data = Buffer.from(JSON.stringify({ transaction_uuid: "nucleus-test", status: "COMPLETE" })).toString("base64");
  assert.equal(callbackTransactionUuid({ data }), "nucleus-test");
  assert.equal(callbackTransactionUuid({ transaction_uuid: "legacy-test" }), "legacy-test");
  for (const payload of ["invalid", "null", "[]", '{"transaction_uuid":123}']) {
    assert.equal(callbackTransactionUuid({ data: Buffer.from(payload).toString("base64") }), null);
  }
  assert.equal(callbackTransactionUuid({}), null);
});

test("eSewa verification selects the matching live or sandbox status API and checks amount", async (t) => {
  const urls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (url: URL) => {
    urls.push(url);
    return Response.json({ status: "COMPLETE", transaction_uuid: "test", total_amount: "100.00" });
  });
  const config = { merchantCode: "merchant", secretKey: "secret", formUrl: "https://epay.esewa.com.np/api/epay/main/v2/form" };
  assert.equal(await verifyEsewa({ transactionUuid: "test", totalAmount: 100, config }), true);
  assert.equal(urls[0].hostname, "epay.esewa.com.np");
  assert.equal(await verifyEsewa({ transactionUuid: "test", totalAmount: 90, config }), false);
  assert.equal(await verifyEsewa({ transactionUuid: "test", totalAmount: 100, config: { ...config, formUrl: "https://rc-epay.esewa.com.np/api/epay/main/v2/form" } }), true);
  assert.equal(urls[2].hostname, "rc-epay.esewa.com.np");
  assert.equal(await verifyEsewa({ transactionUuid: "test", totalAmount: 100, config: { ...config, formUrl: "https://example.com" } }), false);
  assert.equal(urls.length, 3);
});

function guardedDatabase(row: Record<string, unknown>) {
  let locks = 0;
  const query = {
    from: () => query,
    where: () => query,
    limit: () => query,
    for: async (mode: string) => { assert.equal(mode, "update"); locks += 1; return [row]; },
    // Allow the old unlocked path to run too, so assertions catch regressions.
    then: (resolve: (rows: Record<string, unknown>[]) => unknown) => Promise.resolve([row]).then(resolve),
  };
  const tx = {
    select: () => query,
    insert: () => { assert.fail("Rejected financial operation must not insert records"); },
    update: () => { assert.fail("Rejected financial operation must not update records"); },
  };
  return { db: { transaction: async (fn: (transaction: typeof tx) => unknown) => fn(tx) } as unknown as DB, locks: () => locks };
}

test("cancelled invoices cannot accept offline payments or discounts", async () => {
  const state = guardedDatabase({ id: "invoice", status: "cancelled", total: "100", paid: "0" });
  await assert.rejects(addPayment(state.db, "org", "user", { invoiceId: "invoice", amount: 50, method: "cash" }), /Cancelled invoices/);
  await assert.rejects(applyDiscount(state.db, "org", "user", "invoice", 10), /Cancelled invoices/);
  assert.equal(state.locks(), 2);
});

test("payment validates the locked current balance before writing", async () => {
  const state = guardedDatabase({ id: "invoice", status: "partial", total: "100", paid: "80" });
  await assert.rejects(addPayment(state.db, "org", "user", { invoiceId: "invoice", amount: 30, method: "cash" }), /exceeds the invoice balance/);
  assert.equal(state.locks(), 1);
});

test("reviewing an already approved submission cannot create another payment", async () => {
  const state = guardedDatabase({ id: "submission", status: "approved" });
  await assert.rejects(reviewPaymentSubmission(state.db, "org", "user", "submission", { status: "approved" }), /already been reviewed/);
  assert.equal(state.locks(), 1);
});

test("verified payment retries reuse the payment and tenant mismatches are rejected", async (t) => {
  const intent = { orgId: "org", invoiceId: "invoice", userId: "user", amount: 100 };
  t.mock.method(redis, "get", async () => JSON.stringify(intent));
  const deleted = t.mock.method(redis, "del", async () => { assert.fail("Intent must remain available for callback retries"); });
  const verification = t.mock.method(globalThis, "fetch", async () => Response.json({ status: "COMPLETE", transaction_uuid: "test", total_amount: "100.00" }));
  const writes: unknown[] = [];
  const query = (rows: unknown[]) => {
    const builder = {
      from: () => builder, where: () => builder, limit: () => builder,
      for: async () => rows,
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
    };
    return builder;
  };
  let selection = 0;
  const tx = {
    select: () => query(selection++ === 0 ? [{ id: "invoice", total: "100", paid: "100" }] : [{ id: "existing-payment" }]),
    insert: (table: unknown) => { writes.push(table); assert.fail("Duplicate callback must not insert another payment or audit"); },
    update: () => { assert.fail("Duplicate callback must not update the balance"); },
  };
  const db = { transaction: async (fn: (transaction: typeof tx) => unknown) => fn(tx) } as unknown as DB;
  assert.deepEqual(await completeEsewa(db, "org", "test"), { invoiceId: "invoice", duplicate: true });
  assert.equal(writes.length, 0);
  assert.equal(deleted.mock.callCount(), 0);
  assert.equal(verification.mock.callCount(), 1);
  await assert.rejects(completeEsewa(db, "other-org", "test"), /Payment session not found/);
  assert.equal(verification.mock.callCount(), 1);
});
