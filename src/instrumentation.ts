/**
 * Executado no boot de cada instância do servidor (inclusive cada cold
 * start na Vercel), ANTES de a instância atender a primeira requisição.
 *
 * Mantém o schema do banco automaticamente em dia com o código: se o
 * deploy trouxe tabelas/colunas/índices novos, eles são aplicados aqui —
 * sem precisar abrir `/api/admin/setup` a cada atualização.
 *
 * Tudo é idempotente e protegido por advisory lock; em schema já atualizado
 * o custo é de ~3 consultas. Falhas não derrubam o boot: são logadas e
 * repetidas no próximo cold start.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  if (!process.env.DATABASE_URL) {
    console.warn(
      "[schema-ensure] DATABASE_URL não definida — sincronização do schema ignorada.",
    );
    return;
  }

  try {
    // Import dinâmico: erros ao carregar o módulo do banco ficam dentro do
    // try/catch e não derrubam o servidor inteiro.
    const { ensureSchema } = await import("@/db/schema-ensure");
    const r = await ensureSchema();
    if (r.failed > 0) {
      console.warn(
        `[schema-ensure] ${r.failed} declaração(ões) falharam — ` +
          `tente /api/admin/setup?token=... | ${r.errors.join(" | ")}`,
      );
    } else if (r.applied > 0) {
      console.log(
        `[schema-ensure] schema do banco atualizado automaticamente ` +
          `(${r.applied} nova(s) declaração(ões)).`,
      );
    }
  } catch (e) {
    // Nunca quebrar o boot: o retry acontece no próximo cold start.
    console.warn(
      "[schema-ensure] falhou no boot (será repetido):",
      e instanceof Error ? e.message : e,
    );
  }
}
