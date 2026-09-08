import { createHmac, timingSafeEqual } from "node:crypto";
import { getAppUrl } from "@/lib/password-reset";

const API_BASE = "https://api.mercadopago.com";
const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

export const billingDemoEnabled =
  process.env.NODE_ENV !== "production" && process.env.BILLING_DEMO_MODE === "true";

export function isMercadoPagoConfigured(): boolean {
  return !!accessToken;
}

export interface MercadoPagoSubscription {
  id: string;
  status: "pending" | "authorized" | "paused" | "cancelled" | string;
  payer_email?: string;
  external_reference?: string;
  init_point?: string;
  next_payment_date?: string;
  auto_recurring?: {
    frequency?: number;
    frequency_type?: string;
    transaction_amount?: number | string;
    currency_id?: string;
  };
}

export interface MercadoPagoAuthorizedPayment {
  id: number | string;
  preapproval_id: string;
  external_reference?: string;
  transaction_amount?: number | string;
  currency_id?: string;
  debit_date?: string;
  date_created?: string;
  status?: string;
  summarized?: string;
  payment?: {
    id?: number | string;
    status?: string;
    status_detail?: string;
  };
}

export interface MercadoPagoPayment {
  id: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
  date_approved?: string;
  date_created?: string;
}

async function mpFetch<T>(
  endpoint: string,
  options: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {},
): Promise<T> {
  if (!accessToken) throw new Error("Mercado Pago não configurado");

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  const data = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !data) {
    console.error("Mercado Pago API error", response.status, data);
    throw new Error(`Mercado Pago respondeu ${response.status}`);
  }
  return data;
}

/** Cria assinatura pendente e retorna o checkout hospedado pelo Mercado Pago. */
export async function createSubscription(options: {
  userId: number;
  userEmail: string;
  cycle: "monthly" | "yearly";
  priceInCents: number;
  trialEndsAt?: Date | null;
}) {
  if (!accessToken) {
    if (!billingDemoEnabled) throw new Error("billing_not_configured");
    return {
      mode: "demo" as const,
      subscriptionId: `demo-${options.userId}-${Date.now()}`,
      checkoutUrl: null,
    };
  }

  const appUrl = getAppUrl();
  const startDate =
    options.trialEndsAt && options.trialEndsAt.getTime() > Date.now() + 5 * 60_000
      ? options.trialEndsAt.toISOString()
      : undefined;

  const subscription = await mpFetch<MercadoPagoSubscription>("/preapproval", {
    method: "POST",
    body: {
      reason: `GiroLucro Pro — ${options.cycle === "yearly" ? "Anual" : "Mensal"}`,
      external_reference: `girolucro:${options.userId}:${options.cycle}`,
      payer_email: options.userEmail,
      back_url: `${appUrl}/assinatura/sucesso`,
      status: "pending",
      auto_recurring: {
        frequency: options.cycle === "yearly" ? 12 : 1,
        frequency_type: "months",
        transaction_amount: options.priceInCents / 100,
        currency_id: "BRL",
        ...(startDate ? { start_date: startDate } : {}),
      },
    },
  });

  if (!subscription.id || !subscription.init_point) {
    throw new Error("Mercado Pago não retornou o link de checkout");
  }

  return {
    mode: "mercado_pago" as const,
    subscriptionId: subscription.id,
    checkoutUrl: subscription.init_point,
  };
}

export function getSubscription(id: string): Promise<MercadoPagoSubscription> {
  return mpFetch(`/preapproval/${encodeURIComponent(id)}`);
}

export function getAuthorizedPayment(
  id: string,
): Promise<MercadoPagoAuthorizedPayment> {
  return mpFetch(`/authorized_payments/${encodeURIComponent(id)}`);
}

export function getPayment(id: string): Promise<MercadoPagoPayment> {
  return mpFetch(`/v1/payments/${encodeURIComponent(id)}`);
}

export async function cancelSubscription(subscriptionId: string) {
  if (!accessToken) {
    if (billingDemoEnabled) return;
    throw new Error("billing_not_configured");
  }
  await mpFetch<MercadoPagoSubscription>(
    `/preapproval/${encodeURIComponent(subscriptionId)}`,
    { method: "PUT", body: { status: "cancelled" } },
  );
}

/** Valida x-signature conforme o manifesto oficial do Mercado Pago. */
export function verifyMercadoPagoSignature(req: Request, resourceId: string): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) return false;

  const signature = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    }),
  );
  const timestamp = parts.ts;
  const receivedHash = parts.v1;
  if (!resourceId || !requestId || !timestamp || !receivedHash) return false;

  const normalizedId = resourceId.toLowerCase();
  const manifest = `id:${normalizedId};request-id:${requestId};ts:${timestamp};`;
  const expectedHash = createHmac("sha256", secret).update(manifest).digest("hex");
  const expected = Buffer.from(expectedHash, "hex");
  const received = Buffer.from(receivedHash, "hex");

  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function parseGiroLucroReference(reference?: string | null): {
  userId: number;
  cycle: "monthly" | "yearly";
} | null {
  if (!reference) return null;
  const modern = reference.match(/^girolucro:(\d+):(monthly|yearly)$/);
  const legacy = reference.match(/^girolucro-(\d+)-(monthly|yearly)$/);
  const match = modern ?? legacy;
  if (!match) return null;
  const userId = Number(match[1]);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  return { userId, cycle: match[2] as "monthly" | "yearly" };
}
