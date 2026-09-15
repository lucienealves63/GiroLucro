import { NextResponse } from "next/server";
import { pool } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Enche o painel de acessos com dados de demonstração (e permite limpar).
 *
 *   https://SEU-DOMINIO/api/admin/demo-visits?token=SEU_TOKEN&dias=30
 *   https://SEU-DOMINIO/api/admin/demo-visits?token=SEU_TOKEN&action=clear
 *
 * Serve para duas coisas: conferir que o painel está lendo o banco depois do
 * deploy (sem esperar tráfego real) e mostrar o produto funcionando para
 * alguém. Todo registro de mentira tem `visitor_id` iniciando em `demo-`,
 * então a limpeza é trivial e nunca apaga visita de verdade.
 */

const PATHS = ["/", "/landing", "/criar-conta", "/entrar", "/comparar", "/assinatura", "/metas", "/sobre"];
const CHANNELS = ["busca", "social", "direto", "referencia", "anuncio"] as const;
const HOSTS = ["google.com.br", "instagram.com", "facebook.com", "play.google.com", "chatgpt.com"];
const DEVICES = ["mobile", "mobile", "mobile", "desktop", "tablet"];
const BROWSERS = ["Chrome", "Safari", "Samsung Internet", "Firefox"];
const OSES = ["Android", "iOS", "Windows 10/11", "macOS"];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a * 1103515245 + 12345) & 0x7fffffff;
    return a / 0x7fffffff;
  };
}

function dayInBrazil(offsetDays: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() - offsetDays * 86400000));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const expected = process.env.ADMIN_SETUP_TOKEN || "girolucro-setup";
  if (token !== expected) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const hasTable = await pool.query("SELECT to_regclass($1) AS reg", ["public.page_views"]);
    if (!hasTable.rows[0]?.reg) {
      return NextResponse.json(
        {
          error: "A tabela page_views ainda não existe.",
          proximo_passo: "Abra /api/admin/setup?token=SEU_TOKEN e volte aqui em seguida.",
        },
        { status: 409 },
      );
    }

    if ((url.searchParams.get("action") ?? "seed") === "clear") {
      const cleared = await pool.query(`DELETE FROM page_views WHERE visitor_id LIKE 'demo-%'`);
      let msgs = 0;
      if ((await pool.query("SELECT to_regclass($1) AS reg", ["public.contact_messages"])).rows[0]?.reg) {
        const r = await pool.query(`DELETE FROM contact_messages WHERE visitor_id = 'demo-visitante'`);
        msgs = r.rowCount ?? 0;
      }
      return NextResponse.json({ ok: true, removidasVisitas: cleared.rowCount ?? 0, removidasMensagens: msgs });
    }

    const days = Math.max(1, Math.min(180, Number(url.searchParams.get("dias") ?? 30) || 30));
    const perDay = Math.max(2, Math.min(120, Number(url.searchParams.get("porDia") ?? 22) || 22));
    const rand = rng(20260914 + days * 7);
    const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;

    const COLS = 12;
    const rows: unknown[][] = [];

    // jornada realista: nem todo mundo passa por mais de uma página
    const JOURNEYS: string[][] = [
      ["/landing"],
      ["/"],
      ["/landing", "/criar-conta"],
      ["/sobre", "/landing", "/criar-conta", "/comparar"],
      ["/landing", "/entrar", "/comparar", "/metas"],
      ["/comparar", "/assinatura"],
      ["/"],
      ["/landing", "/criar-conta", "/assinatura"],
    ];

    for (let i = days - 1; i >= 0; i--) {
      const day = dayInBrazil(i);
      const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0=dom
      // fim de semana rende mais; terça costuma ser o dia fraco
      const weight = weekday === 0 || weekday === 6 ? 1.25 : weekday === 1 ? 0.85 : weekday === 2 ? 0.55 : 1;
      const people = Math.max(1, Math.round((perDay / 2.2) * weight * (0.6 + rand() * 0.8)));

      for (let k = 0; k < people; k++) {
        const channel = pick(CHANNELS);
        const host = channel === "direto" ? null : pick(HOSTS);
        const device = pick(DEVICES);
        const browser = pick(BROWSERS);
        const osName = pick(OSES);
        const visitor = `demo-${day}-p${Math.floor(rand() * 900000)}`;
        const session = `demo-${day}-s${Math.floor(rand() * 900000)}`;
        const journey = rand() < 0.42 ? [pick(JOURNEYS)[0]!] : pick(JOURNEYS);
        const startHour = 6 + Math.floor(rand() * 17);

        journey.forEach((path, idx) => {
          const createdAt = new Date(
            Date.now() - i * 86400000 - (23 - startHour) * 3600_000 + idx * (20_000 + Math.floor(rand() * 90_000)),
          );
          rows.push([
            visitor,
            session,
            path,
            channel,
            host,
            device,
            browser,
            osName,
            idx === journey.length - 1 && rand() < 0.15 ? 0 : Math.round(7000 + rand() * 150000),
            day,
            createdAt,
            false,
          ]);
        });
      }
    }

    const chunk = 250; // 12 colunas × 250 = 3000 parâmetros (bem abaixo do limite)
    for (let start = 0; start < rows.length; start += chunk) {
      const slice = rows.slice(start, start + chunk);
      const values: unknown[] = slice.flat();
      const tuples = slice.map(
        (_, i) =>
          `(${Array.from({ length: COLS }, (_, c) => `$${i * COLS + c + 1}`).join(",")})`,
      );
      await pool.query(
        `INSERT INTO "page_views"
           ("visitor_id","session_id","path","channel","referrer_domain","device_type",
            "browser","os","dwell_ms","day","created_at","is_bot")
         VALUES ${tuples.join(",")}`,
        values as never[],
      );
    }

    // uma mensagem de exemplo na caixa de entrada, para o /contato também aparecer vivo
    if ((await pool.query("SELECT to_regclass($1) AS reg", ["public.contact_messages"])).rows[0]?.reg) {
      await pool.query(
        `INSERT INTO "contact_messages"
           ("name","email","phone","topic","body","status","visitor_id","source_path","reply_to_email","ip_hash","created_at")
         VALUES
           ('Motorista de Exemplo','motorista.exemplo@girolucro.app','(11) 90000-0000','recurso',
            'Seria ótimo poder lançar o combustível por posto. Aqui a gasolina varia 40 centavos por bairro e eu quero ver qual posto me dá mais lucro líquido no fim da semana.','novo',
            'demo-visitante','/contato',true,'demo', now() - interval '1 day')`,
      );
    }

    return NextResponse.json({
      ok: true,
      criado: rows.length,
      mensagemDeExemplo: true,
      aviso:
        "São visitas de demonstração (visitor_id começa com “demo-”). Limpe com ?action=clear antes de olhar números de verdade.",
      painel: "/admin",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[demo-visits]", message);
    return NextResponse.json({ error: "Falha ao gerar demonstração.", detail: message }, { status: 500 });
  }
}
