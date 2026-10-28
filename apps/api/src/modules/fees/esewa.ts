import { createHmac, randomUUID } from "node:crypto";
import { env } from "../../env";

function signature(value: string) {
  return createHmac("sha256", env.ESEWA_SECRET_KEY).update(value).digest("base64");
}

export function createEsewaRequest(input: { amount: number; transactionUuid: string }) {
  const totalAmount = input.amount.toFixed(2);
  return {
    amount: totalAmount,
    tax_amount: "0",
    total_amount: totalAmount,
    transaction_uuid: input.transactionUuid,
    product_code: env.ESEWA_MERCHANT_CODE,
    product_service_charge: "0",
    product_delivery_charge: "0",
    success_url: `${env.PAYMENT_CALLBACK_URL}/success`,
    failure_url: `${env.PAYMENT_CALLBACK_URL}/failure`,
    signed_field_names: "total_amount,transaction_uuid,product_code",
    signature: signature(`total_amount=${totalAmount},transaction_uuid=${input.transactionUuid},product_code=${env.ESEWA_MERCHANT_CODE}`),
  };
}

export function newTransactionUuid() {
  return `nucleus-${randomUUID()}`;
}

export async function verifyEsewa(input: { transactionUuid: string; totalAmount: number }) {
  const url = new URL("https://rc-epay.esewa.com.np/api/epay/transaction/status/");
  url.searchParams.set("product_code", env.ESEWA_MERCHANT_CODE);
  url.searchParams.set("total_amount", input.totalAmount.toFixed(2));
  url.searchParams.set("transaction_uuid", input.transactionUuid);
  const response = await fetch(url);
  if (!response.ok) return false;
  const payload = await response.json() as { status?: string; transaction_uuid?: string; total_amount?: string | number };
  return payload.status === "COMPLETE" && payload.transaction_uuid === input.transactionUuid && Number(payload.total_amount) === input.totalAmount;
}

export { env };
