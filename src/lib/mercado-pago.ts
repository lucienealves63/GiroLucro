import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
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

export interface MercadoPagoPixPayment {
  id: number | string;
  status?: string;
  status_detail?: string;
  transaction_amount?: number;
  currency_id?: string;
  date_of_expiration?: string;
  external_reference?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
}

/**
 * Validade do QR Code Pix gerado à vista.
 * O Mercado Pago aceita `date_of_expiration` entre 30 minutos e 30 dias.
 */
export const PIX_QR_MINUTES = 60;

async function mpFetch<T>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PUT";
    body?: unknown;
    /** Headers extras mesclados aos padrões (ex.: X-Idempotency-Key). */
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  if (!accessToken) throw new Error("Mercado Pago não configurado");

  const method = options.method ?? "GET";
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  const data = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !data) {
    const detail =
      data &&
      typeof data === "object" &&
      "message" in data
        ? String((data as { message?: unknown }).message)
        : data
          ? JSON.stringify(data).slice(0, 300)
          : response.statusText || "sem resposta";
    console.error(`[billing] ${method} ${endpoint} => ${response.status} ${detail}`);
    throw new Error(`Mercado Pago respondeu ${response.status}`);
  }

  const detail =
    data && typeof data === "object" && "id" in data
      ? `id=${String((data as { id?: unknown }).id ?? "")}`
      : "ok";
  console.info(`[billing] ${method} ${endpoint} => ${response.status} ${detail}`);
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

export function getPixPayment(id: string): Promise<MercadoPagoPixPayment> {
  return mpFetch(`/v1/payments/${encodeURIComponent(id)}`);
}

/** Gera um Pix à vista (pagamento único) e retorna o QR Code. */
export async function createPixCharge({
  userId,
  userEmail,
  cycle,
  priceInCents,
}: {
  userId: number;
  userEmail: string;
  cycle: "monthly" | "yearly";
  priceInCents: number;
}) {
  if (!accessToken) throw new Error("billing_not_configured");

  const appUrl = getAppUrl();
  const expiresAt = new Date(Date.now() + PIX_QR_MINUTES * 60_000);

  const payment = await mpFetch<MercadoPagoPixPayment>("/v1/payments", {
    method: "POST",
    // Obrigatório no POST /v1/payments; sem ele o MP responde 400
    // "Header X-Idempotency-Key can't be null". Uma chave nova por tentativa.
    headers: { "X-Idempotency-Key": randomUUID() },
    body: {
      transaction_amount: priceInCents / 100,
      payment_method_id: "pix",
      payer: { email: userEmail },
      external_reference: `girolucro:${userId}:${cycle}`,
      notification_url: `${appUrl}/api/billing/webhook`,
      date_of_expiration: expiresAt.toISOString(),
    },
  });

  const transaction = payment.point_of_interaction?.transaction_data;
  const qrCode = transaction?.qr_code ?? "";
  const qrCodeBase64 = transaction?.qr_code_base64 ?? "";
  const ticketUrl = transaction?.ticket_url ?? "";

  if (!payment.id || (!qrCode && !qrCodeBase64)) {
    throw new Error("Mercado Pago não retornou o QR Code");
  }

  return {
    paymentId: String(payment.id),
    status: payment.status ?? "pending",
    qrCode,
    qrCodeBase64,
    ticketUrl,
    expiresAt,
  };
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
