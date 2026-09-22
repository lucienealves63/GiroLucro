import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildAccountExport, exportFileName, logDataSubjectRequest } from "@/lib/account";

export const dynamic = "force-dynamic";

/**
 * GET /api/account/export — portabilidade dos dados (LGPD art. 18, II).
 *
 * Devolve um JSON só com os dados do usuário da sessão. Nunca aceita id vindo
 * do cliente, então não existe caminho para exportar a conta de outra pessoa.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const payload = await buildAccountExport(user);
    const body = JSON.stringify(payload, null, 2);

    await logDataSubjectRequest({
      userId: user.id,
      requestType: "export",
      note: "exportação em JSON/JSON download",
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName(user.id)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[account] falha ao exportar dados:", error);
    return NextResponse.json(
      { error: "Não foi possível gerar o arquivo agora. Tente novamente." },
      { status: 500 },
    );
  }
}
