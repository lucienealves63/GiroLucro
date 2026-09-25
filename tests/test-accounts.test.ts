import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { STATEMENTS } from "@/db/schema-ensure";
import { createTestDbWithSchema, type TestDb } from "./helpers/pgmem";

/**
 * Conta de teste (`users.is_test`):
 *   • acesso Pro sempre liberado, sem trial e sem cobrança (`hasAccess`);
 *   • fora das estatísticas de negócio do painel (testado no fim do arquivo).
 */

let db: TestDb;
let poolQuery: jest.Mock;

jest.mock("@/db", () => ({
  get db() {
    return db;
  },
  // usado pelo painel (`buildReport`), que consulta direto no pool
  get pool() {
    return {
      query: (text: string, params?: unknown[]) => poolQuery(text, params),
    };
  },
}));
jest.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }));
jest.mock("next/navigation", () => ({ redirect: () => undefined }));

const { hasAccess, trialDaysLeft } = require("@/lib/auth") as typeof import("@/lib/auth");
const { isTestAccount, listTestAccounts, setTestAccountByEmail, setTestAccountById } =
  require("@/lib/test-accounts") as typeof import("@/lib/test-accounts");

type SeedOptions = {
  id: number;
  email: string;
  isTest?: boolean;
  planStatus?: string;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
};

async function seedUser(opts: SeedOptions) {
  await db.insert(users).values({
    id: opts.id,
    name: `Conta ${opts.id}`,
    email: opts.email,
    passwordHash: "x",
    isTest: opts.isTest ?? false,
    planStatus: opts.planStatus ?? "trialing",
    trialEndsAt: opts.trialEndsAt ?? null,
    currentPeriodEnd: opts.currentPeriodEnd ?? null,
  });
}

async function readUser(id: number) {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row;
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

beforeEach(async () => {
  db = await createTestDbWithSchema();
  poolQuery = jest.fn(async () => ({ rows: [] }));
});

describe("marcação de conta de teste", () => {
  beforeEach(async () => {
    await seedUser({ id: 1, email: "dono@exemplo.com" });
    await seedUser({ id: 2, email: "cliente@exemplo.com" });
  });

  it("começa desmarcada e pode ser marcada/desmarcada pelo id", async () => {
    expect(isTestAccount(await readUser(1))).toBe(false);

    const marcada = await setTestAccountById(1, true);
    expect(marcada).toMatchObject({ id: 1, isTest: true, changed: true });
    expect(isTestAccount(await readUser(1))).toBe(true);

    // repetir não é erro — só não muda nada
    expect(await setTestAccountById(1, true)).toMatchObject({ changed: false });

    const desmarcada = await setTestAccountById(1, false);
    expect(desmarcada).toMatchObject({ isTest: false, changed: true });
    expect(isTestAccount(await readUser(1))).toBe(false);
  });

  it("marca pelo e-mail, sem depender de maiúsculas/minúsculas", async () => {
    const r = await setTestAccountByEmail("CLIENTE@Exemplo.com", true);
    expect(r).toMatchObject({ id: 2, email: "cliente@exemplo.com", changed: true });
    expect(isTestAccount(await readUser(2))).toBe(true);
    // a outra conta continua real
    expect(isTestAccount(await readUser(1))).toBe(false);
  });

  it("e-mail sem conta (ou vazio) não muda nada", async () => {
    expect(await setTestAccountByEmail("ninguem@exemplo.com", true)).toBeNull();
    expect(await setTestAccountByEmail("   ", true)).toBeNull();
    expect(await setTestAccountById(999, true)).toBeNull();
  });

  it("lista somente as contas de teste", async () => {
    await setTestAccountById(2, true);
    const lista = await listTestAccounts();
    expect(lista.map((a) => a.id)).toEqual([2]);
    expect(lista[0].email).toBe("cliente@exemplo.com");
  });
});

describe("acesso Pro da conta de teste", () => {
  it("libera o acesso mesmo com o trial vencido", async () => {
    await seedUser({
      id: 1,
      email: "dono@exemplo.com",
      isTest: true,
      planStatus: "trialing",
      trialEndsAt: daysAgo(10),
    });
    const user = await readUser(1);
    expect(hasAccess(user)).toBe(true);
    // sem a marca, o mesmo cadastro fica sem acesso
    expect(hasAccess({ ...user, isTest: false })).toBe(false);
  });

  it("libera o acesso mesmo sem plano pago e sem trial", async () => {
    await seedUser({ id: 2, email: "teste@exemplo.com", isTest: true, planStatus: "canceled" });
    expect(hasAccess(await readUser(2))).toBe(true);
  });

  it("não mostra contagem de dias de teste", async () => {
    await seedUser({
      id: 3,
      email: "teste3@exemplo.com",
      isTest: true,
      planStatus: "trialing",
      trialEndsAt: daysAhead(5),
    });
    const user = await readUser(3);
    expect(trialDaysLeft(user)).toBeNull();
    expect(trialDaysLeft({ ...user, isTest: false })).toBe(5);
  });

  it("não interfere em quem não é conta de teste", async () => {
    await seedUser({
      id: 4,
      email: "cliente@exemplo.com",
      planStatus: "trialing",
      trialEndsAt: daysAhead(3),
    });
    const user = await readUser(4);
    expect(hasAccess(user)).toBe(true); // trial válido
    expect(trialDaysLeft(user)).toBe(3);
  });
});

describe("schema e marcação automática da conta administrativa", () => {
  const ownerStatement = () => STATEMENTS.find((s) => s.name === "users.is_test_owner");
  const columnStatement = () => STATEMENTS.find((s) => s.name === "users.is_test");

  it("declara a coluna na criação da tabela e na migração", () => {
    expect(STATEMENTS.find((s) => s.name === "users")?.sql).toContain(
      `"is_test" boolean DEFAULT false NOT NULL`,
    );
    expect(columnStatement()?.sql).toContain(`ADD COLUMN IF NOT EXISTS "is_test"`);
  });

  it("a declaração de dados marca a conta do dono quando ela existe", async () => {
    const st = ownerStatement();
    expect(st?.kind).toBe("data");
    // conta que já existe antes da migração entra como conta de teste
    await seedUser({ id: 10, email: "lucienealves63@gmail.com" });
    await seedUser({ id: 11, email: "cliente@exemplo.com" });

    await db.raw(st!.sql);

    expect(isTestAccount(await readUser(10))).toBe(true);
    expect(isTestAccount(await readUser(11))).toBe(false);
    // e a checagem passa a considerá-la aplicada (nada de rodar de novo)
    const check = await db.raw(st!.check!);
    expect(check.rows[0]?.ok).toBe(true);
  });

  it("não marca ninguém quando a conta do dono ainda não existe", async () => {
    const before = await db.select({ id: users.id }).from(users);
    await db.raw(ownerStatement()!.sql);
    const after = await db.select({ id: users.id }).from(users);
    expect(after.length).toBe(before.length);
  });
});

describe("painel: card de contas de teste", () => {
  const { viewSubscribers } = require("@/lib/admin-views") as typeof import("@/lib/admin-views");
  type Report = import("@/lib/admin-report").Report;

  const reportStub = {
    ok: true,
    problems: [],
    range: { days: 30, from: "2026-08-27", to: "2026-09-25", label: "2026-09-25" },
    visits: null,
    subscribers: {
      total: 3,
      newInPeriod: 1,
      prevNew: 0,
      trialsActive: 1,
      trialsExpired: 0,
      trialsEndingSoon: 0,
      paying: 1,
      canceled: 0,
      pendingPayment: 0,
      revenue: 19.9,
      signupRate: 0.5,
      paidRate: 0.33,
      activeLast7: 1,
      byStatus: [],
      series: [],
      recent: [
        {
          id: 1,
          name: "Luciene Alves",
          email: "lucienealves63@gmail.com",
          createdDay: "2026-09-20",
          statusLabel: "Conta de teste",
          statusClass: "teste",
          channel: "direto",
          referrer: "—",
          entryPath: "/",
          isTest: true,
        },
        {
          id: 2,
          name: "Cliente Real",
          email: "cliente@exemplo.com",
          createdDay: "2026-09-21",
          statusLabel: "Em teste",
          statusClass: "trial",
          channel: "busca",
          referrer: "google.com.br",
          entryPath: "/landing",
          isTest: false,
        },
      ],
      attribution: [],
      topLandingPages: [],
      testAccounts: [
        {
          id: 1,
          name: "Luciene Alves",
          email: "lucienealves63@gmail.com",
          createdDay: "2026-09-20",
          planLabel: "Em teste",
        },
      ],
      testTotal: 1,
    },
    contact: { unread: 0, total: 0, rows: [] },
    requests: { refunds: [], refundsPending: 0, dataRequests: [] },
  } as unknown as Report;

  it("mostra o card, o formulário por e-mail e os botões de marcar/desmarcar", () => {
    const html = viewSubscribers(reportStub, "csrf-123", "?token=segredo");

    expect(html).toContain("Contas de teste");
    expect(html).toContain("fora das estatísticas");
    // marcar qualquer conta pelo e-mail
    expect(html).toContain('name="action" value="test_add"');
    expect(html).toContain('type="email"');
    // links do formulário preservam a aba e o token
    expect(html).toContain("/admin?aba=assinantes&amp;token=segredo");
    // a conta de teste aparece listada, com botão de remover
    expect(html).toContain("lucienealves63@gmail.com");
    expect(html).toContain('name="action" value="test_remove"');
    expect(html).toContain("remover teste");
    // e a lista de cadastros permite marcar uma conta comum
    expect(html).toContain("tornar teste");
    expect(html).toContain('value="csrf-123"');
  });
});

describe("painel: ação de marcar/desmarcar (CSRF + banco)", () => {
  const TOKEN = "token-de-teste";
  const { POST } = require("@/app/admin/route") as {
    POST: (req: Request) => Promise<Response>;
  };
  const { makeAdminCookieValue } = require("@/lib/admin-auth") as typeof import("@/lib/admin-auth");

  /** POST do painel com o cookie de admin e o CSRF (double-submit). */
  async function postPanel(fields: Record<string, string>): Promise<Response> {
    const cookie = makeAdminCookieValue(TOKEN);
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    form.set("csrf", cookie);
    return POST(
      new Request("http://localhost/admin?aba=assinantes", {
        method: "POST",
        headers: { cookie: `gl_admin=${encodeURIComponent(cookie)}` },
        body: form,
      }),
    );
  }

  beforeEach(() => {
    process.env.ADMIN_SETUP_TOKEN = TOKEN;
  });

  it("marca pelo e-mail do formulário e volta com o aviso de sucesso", async () => {
    await seedUser({ id: 5, email: "dono@exemplo.com" });

    const res = await postPanel({ action: "test_add", tab: "assinantes", email: "dono@exemplo.com" });

    expect(res.status).toBe(303);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("aba=assinantes");
    expect(location).toContain("ok=test_on");
    expect(isTestAccount(await readUser(5))).toBe(true);
  });

  it("desmarca pela lista de cadastros (id) e avisa de novo", async () => {
    await seedUser({ id: 6, email: "qa@exemplo.com", isTest: true });

    const res = await postPanel({ action: "test_remove", tab: "assinantes", id: "6" });

    expect((res.headers.get("location") ?? "")).toContain("ok=test_off");
    expect(isTestAccount(await readUser(6))).toBe(false);
  });

  it("e-mail que não existe volta com o aviso de conta não encontrada", async () => {
    const res = await postPanel({ action: "test_add", tab: "assinantes", email: "ninguem@exemplo.com" });
    expect((res.headers.get("location") ?? "")).toContain("ok=test_notfound");
  });

  it("sem o CSRF do painel a ação não passa", async () => {
    await seedUser({ id: 7, email: "dono@exemplo.com" });
    const cookie = makeAdminCookieValue(TOKEN);
    const form = new FormData();
    form.set("action", "test_add");
    form.set("tab", "assinantes");
    form.set("email", "dono@exemplo.com");
    form.set("csrf", "errado");

    const res = await POST(
      new Request("http://localhost/admin?aba=assinantes", {
        method: "POST",
        headers: { cookie: `gl_admin=${encodeURIComponent(cookie)}` },
        body: form,
      }),
    );

    expect(res.status).toBe(400);
    expect(isTestAccount(await readUser(7))).toBe(false);
  });
});

describe("painel: contas de teste fora das estatísticas", () => {
  it("toda consulta que lê a tabela users filtra as contas de teste", async () => {
    const captured: string[] = [];
    poolQuery = jest.fn(async (text: string) => {
      captured.push(text);
      return { rows: [] };
    });

    const { buildReport } = require("@/lib/admin-report") as typeof import("@/lib/admin-report");
    await buildReport(30);

    const leemUsuarios = captured.filter((q) => /\b(FROM|JOIN)\s+users\b/i.test(q));
    expect(leemUsuarios.length).toBeGreaterThan(0);
    expect(leemUsuarios.filter((q) => !/is_test/.test(q))).toEqual([]);
  });

  it("os números de cadastros/pagantes contam só contas reais", async () => {
    const captured: string[] = [];
    poolQuery = jest.fn(async (text: string) => {
      captured.push(text);
      return { rows: [] };
    });

    const { buildReport } = require("@/lib/admin-report") as typeof import("@/lib/admin-report");
    const report = await buildReport(30);

    const contagens = captured.filter((q) => /count\(\*\)::int AS total/.test(q));
    expect(contagens.length).toBe(1);
    expect(contagens[0]).toContain("u.is_test = false");
    expect(report.subscribers.testTotal).toBe(0);
  });
});
