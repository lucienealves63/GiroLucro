import { eq } from "drizzle-orm";
import { billingEvents, users } from "@/db/schema";
import { createTestDbWithSchema, type TestDb } from "./helpers/pgmem";

/**
 * Verificação ativa do pagamento único ("Já paguei, verificar").
 *
 * Garante que a conta vira vitalícia MESMO sem webhook do Mercado Pago:
 *   • Pix aprovado → ativa na hora, grava recibo comercial e evento idempotente;
 *   • reverificar o mesmo pagamento não duplica nada;
 *   • valor errado / não aprovado → NÃO ativa;
 *   • Checkout Pro (pref:) → encontra o pagamento pela preferência;
 *   • sem cobrança pendente → nada a fazer.
 */

let db: TestDb;

jest.mock("@/db", () => ({
  get db() {
    return db;
  },
}));

jest.mock("@/lib/purchase", () => ({
  sendPurchaseReceipt: jest.fn().mockResolvedValue({ sent: false }),
}));

jest.mock("@/lib/mercado-pago", () => {
  const actual = jest.requireActual("@/lib/mercado-pago");
  return {
    ...actual,
    getPixPayment: jest.fn(),
    searchPaymentsByPreference: jest.fn(),
  };
});

const { activateLifetimeFromPayment, checkLifetimePayment, verifyPendingPayment } = require(
  "@/lib/billing-activation",
) as typeof import("@/lib/billing-activation");
const mercadoPago = require("@/lib/mercado-pago") as typeof import("@/lib/mercado-pago");

type SeedOptions = {
  id: number;
  email?: string;
  planStatus?: string;
  billingCustomerId?: string | null;
  paymentId?: string | null;
};

async function seedUser(opts: SeedOptions) {
  await db.insert(users).values({
    id: opts.id,
    name: `Conta ${opts.id}`,
    email: opts.email ?? `conta${opts.id}@teste.local`,
    passwordHash: "x",
    planStatus: opts.planStatus ?? "pending_payment",
    billingCustomerId: opts.billingCustomerId ?? null,
    paymentId: opts.paymentId ?? null,
    trialEndsAt: new Date(Date.now() - 86_400_000),
  });
  const [row] = await db.select().from(users).where(eq(users.id, opts.id)).limit(1);
  return row;
}

async function readUser(id: number) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

function approvedPayment(userId: number, overrides: Record<string, unknown> = {}) {
  return {
    id: 999,
    status: "approved",
    status_detail: "accredited",
    external_reference: `girolucro:${userId}:lifetime`,
    transaction_amount: 19.9,
    currency_id: "BRL",
    date_approved: "2026-10-14T12:00:00.000-03:00",
    date_created: "2026-10-14T11:59:00.000-03:00",
    ...overrides,
  };
}

beforeAll(async () => {
  db = await createTestDbWithSchema();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("checkLifetimePayment", () => {
  it("aprova pagamento válido do próprio usuário no valor do plano", () => {
    const check = checkLifetimePayment(approvedPayment(7), { id: 7 });
    expect(check).toMatchObject({ ok: true, amount: 19.9 });
  });

  it.each([
    ["status", approvedPayment(7, { status: "pending" })],
    ["amount", approvedPayment(7, { transaction_amount: 9.9 })],
    ["currency", approvedPayment(7, { currency_id: "USD" })],
    ["reference", approvedPayment(7, { external_reference: "outra-app:7:lifetime" })],
    ["user", approvedPayment(8)],
  ] as const)("rejeita com motivo %s", (reason, payment) => {
    const check = checkLifetimePayment(payment, { id: 7 });
    expect(check).toMatchObject({ ok: false, reason });
  });
});

describe("verifyPendingPayment (Pix)", () => {
  it("ativa o vitalício com pagamento Pix aprovado, mesmo sem webhook", async () => {
    const user = await seedUser({ id: 1, billingCustomerId: "pix:999" });
    (mercadoPago.getPixPayment as jest.Mock).mockResolvedValue(approvedPayment(1));

    const outcome = await verifyPendingPayment(user);

    expect(outcome.checked).toBe(true);
    expect(outcome.activation?.activated).toBe(true);

    const after = await readUser(1);
    expect(after.planStatus).toBe("active");
    expect(after.planCycle).toBe("lifetime");
    expect(after.paymentId).toBe("999");
    expect(after.paymentStatus).toBe("approved");
    expect(after.paymentProvider).toBe("mercado_pago");
    expect(Number(after.paymentAmount)).toBeCloseTo(19.9);
    expect(after.paidAt).not.toBeNull();
    expect(after.currentPeriodEnd?.getTime()).toBeGreaterThan(Date.now());

    // evento idempotente registrado
    const events = await db.select().from(billingEvents).where(eq(billingEvents.resourceId, "999"));
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe("processed");
    expect(events[0].userId).toBe(1);
  });

  it("reverificar o mesmo pagamento é idempotente (sem recibo duplicado)", async () => {
    const { sendPurchaseReceipt } = require("@/lib/purchase") as {
      sendPurchaseReceipt: jest.Mock;
    };

    const user = await seedUser({ id: 2, billingCustomerId: "pix:999" });
    (mercadoPago.getPixPayment as jest.Mock).mockResolvedValue(approvedPayment(2));

    const first = await verifyPendingPayment(user);
    expect(first.activation?.activated).toBe(true);

    // usuário re-lido do banco (estado pós-ativação), como a rota faz
    const fresh = await readUser(2);
    const second = await verifyPendingPayment(fresh);
    expect(second.activation?.alreadyActive).toBe(true);
    expect(second.activation?.activated).toBe(false);

    expect(sendPurchaseReceipt).toHaveBeenCalledTimes(1);
    const events = await db.select().from(billingEvents).where(eq(billingEvents.resourceId, "999"));
    expect(events.filter((e) => e.userId === 2)).toHaveLength(1);
  });

  it("não ativa com valor diferente do plano", async () => {
    const user = await seedUser({ id: 3, billingCustomerId: "pix:999" });
    (mercadoPago.getPixPayment as jest.Mock).mockResolvedValue(
      approvedPayment(3, { transaction_amount: 5 }),
    );

    const outcome = await verifyPendingPayment(user);

    expect(outcome.activation).toBeUndefined();
    expect(outcome.reason).toBe("amount");
    const after = await readUser(3);
    expect(after.planStatus).toBe("pending_payment");
    expect(after.paymentStatus).toBeNull();
  });

  it("não ativa pagamento pendente", async () => {
    const user = await seedUser({ id: 4, billingCustomerId: "pix:999" });
    (mercadoPago.getPixPayment as jest.Mock).mockResolvedValue(
      approvedPayment(4, { status: "pending" }),
    );

    const outcome = await verifyPendingPayment(user);

    expect(outcome.reason).toBe("status");
    expect(outcome.paymentStatus).toBe("pending");
    const after = await readUser(4);
    expect(after.planStatus).toBe("pending_payment");
  });

  it("ativa a partir de activateLifetimeFromPayment direto (recibo uma vez por compra)", async () => {
    const { sendPurchaseReceipt } = require("@/lib/purchase") as {
      sendPurchaseReceipt: jest.Mock;
    };

    const user = await seedUser({
      id: 5,
      planStatus: "trialing",
      paymentId: "777",
      billingCustomerId: "pix:999",
    });
    const result = await activateLifetimeFromPayment(user, approvedPayment(5, { id: 777 }));
    expect(result.activated).toBe(true);

    // compra já registrada → sem recibo novo
    expect(sendPurchaseReceipt).not.toHaveBeenCalled();
    const after = await readUser(5);
    expect(after.planStatus).toBe("active");
  });
});

describe("verifyPendingPayment (Checkout Pro)", () => {
  it("encontra o pagamento pela preferência e ativa o vitalício", async () => {
    const user = await seedUser({ id: 6, billingCustomerId: "pref:PREF123" });
    (mercadoPago.searchPaymentsByPreference as jest.Mock).mockResolvedValue([
      approvedPayment(6, { id: 555, status: "pending" }),
      approvedPayment(6, { id: 556 }),
    ]);

    const outcome = await verifyPendingPayment(user);

    expect(mercadoPago.searchPaymentsByPreference).toHaveBeenCalledWith("PREF123");
    expect(outcome.activation?.activated).toBe(true);
    const after = await readUser(6);
    expect(after.planStatus).toBe("active");
    expect(after.paymentId).toBe("556");
  });

  it("sem pagamento ainda, apenas informa (não ativa)", async () => {
    const user = await seedUser({ id: 9, billingCustomerId: "pref:PREF404" });
    (mercadoPago.searchPaymentsByPreference as jest.Mock).mockResolvedValue([]);

    const outcome = await verifyPendingPayment(user);

    expect(outcome.checked).toBe(true);
    expect(outcome.activation).toBeUndefined();
    const after = await readUser(9);
    expect(after.planStatus).toBe("pending_payment");
  });
});

describe("verifyPendingPayment (sem cobrança pendente)", () => {
  it("nada a verificar quando a conta não tem cobrança vinculada", async () => {
    const user = await seedUser({ id: 10, billingCustomerId: null });

    const outcome = await verifyPendingPayment(user);

    expect(outcome).toMatchObject({ checked: false, reason: "no_pending_charge" });
    expect(mercadoPago.getPixPayment).not.toHaveBeenCalled();
  });
});
