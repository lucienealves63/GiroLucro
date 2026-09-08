import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/");

  const { token = "" } = await searchParams;
  if (token.length < 32 || token.length > 200) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-[25px] font-bold text-zinc-50">Link inválido</h1>
        <p className="mt-2 max-w-[300px] text-[13px] leading-relaxed text-zinc-400">
          Este link está incompleto ou já não pode ser usado. Solicite uma nova
          recuperação de senha.
        </p>
        <a
          href="/esqueci-senha"
          className="pressable mt-6 rounded-2xl bg-volt-400 px-6 py-3.5 font-display text-[14px] font-bold text-ink-950"
        >
          Solicitar outro link
        </a>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
