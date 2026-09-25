import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Contas de teste — a conta administrativa do dono do app, QA e demonstrações.
 *
 * Regra (uma só, usada em todo o app):
 *   • `users.is_test = true` → acesso Pro **sempre** liberado (sem trial, sem
 *     cobrança) e a conta **não entra** nas estatísticas de negócio do /admin
 *     (cadastros, conversão, pagantes, receita e funil).
 *
 * Marcar/desmarcar é feito no painel (`/admin?aba=assinantes`), sem deploy.
 * A conta administrativa é marcada automaticamente no deploy (ver
 * `src/db/schema-ensure.ts` → declaração `users.is_test_owner`).
 */

/**
 * E-mail da conta administrativa — vira conta de teste automaticamente.
 * Pode ser trocado pela variável de ambiente OWNER_TEST_EMAIL.
 */
export const OWNER_TEST_EMAIL = (
  process.env.OWNER_TEST_EMAIL ?? "lucienealves63@gmail.com"
)
  .trim()
  .toLowerCase();

/** Alguma coisa com (ou sem) a marca de conta de teste. */
export function isTestAccount(
  user: { isTest?: boolean | null } | null | undefined,
): boolean {
  return Boolean(user?.isTest);
}

export type TestAccount = {
  id: number;
  name: string;
  email: string;
  planStatus: string;
  createdAt: Date;
};

/**
 * Contas de teste cadastradas, em ordem de cadastro.
 *
 * O painel monta a lista dele na própria consulta agregada
 * (`src/lib/admin-report.ts`); esta função é a porta de entrada tipada para
 * consultas internas e testes.
 */
export async function listTestAccounts(limit = 50): Promise<TestAccount[]> {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      planStatus: users.planStatus,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.isTest, true))
    .orderBy(asc(users.id))
    .limit(Math.max(1, Math.min(limit, 200)));
}

export type TestAccountResult = {
  id: number;
  name: string;
  email: string;
  isTest: boolean;
  /** `false` quando a conta já estava no estado pedido (nada foi gravado). */
  changed: boolean;
};

/**
 * Marca/desmarca uma conta como conta de teste pelo **id** (vem do painel).
 * Retorna `null` quando a conta não existe.
 */
export async function setTestAccountById(
  userId: number,
  isTest: boolean,
): Promise<TestAccountResult | null> {
  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email, isTest: users.isTest })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return null;
  if (row.isTest === isTest) {
    return { ...row, changed: false };
  }
  await db.update(users).set({ isTest }).where(eq(users.id, userId));
  return { ...row, isTest, changed: true };
}

/**
 * Marca/desmarca uma conta como conta de teste pelo **e-mail** (formulário do
 * painel: permite marcar qualquer conta, sem precisar achá-la na lista).
 * Retorna `null` quando nenhuma conta tem esse e-mail.
 */
export async function setTestAccountByEmail(
  email: string,
  isTest: boolean,
): Promise<TestAccountResult | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalized}`)
    .limit(1);
  if (!row) return null;
  return setTestAccountById(row.id, isTest);
}
