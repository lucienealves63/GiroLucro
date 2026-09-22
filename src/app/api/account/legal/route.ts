import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { logDataSubjectRequest } from "@/lib/account";
import { acceptanceSummary, recordLegalAcceptance } from "@/lib/legal-acceptance";

export const dynamic = "force-dynamic";

/**
 * POST /api/account/legal — registra novo aceite dos Termos de Uso e da
 * Política de Privacidade na versão vigente (ex.: quando um documento muda e
 * o usuário confirma a leitura em /configuracoes).
 */
export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const snapshot = await recordLegalAcceptance(user.id, "settings");
    await logDataSubjectRequest({
      userId: user.id,
      requestType: "consent",
      note: `aceite ${snapshot.termsVersion}/${snapshot.privacyVersion}`,
    });

    return NextResponse.json({
      ok: true,
      acceptance: acceptanceSummary({
        termsVersion: snapshot.termsVersion,
        termsAcceptedAt: snapshot.termsAcceptedAt,
        privacyVersion: snapshot.privacyVersion,
        privacyAcceptedAt: snapshot.privacyAcceptedAt,
      }),
    });
  } catch (error) {
    console.error("[account] falha ao registrar aceite:", error);
    return NextResponse.json(
      { error: "Não foi possível registrar o aceite agora." },
      { status: 500 },
    );
  }
}
