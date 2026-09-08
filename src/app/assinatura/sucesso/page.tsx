import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser, hasAccess } from "@/lib/auth";
import { CheckCircle2, Home, Loader2 } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function SuccessContent() {
  const initialUser = await getSessionUser();
  if (!initialUser) redirect("/entrar");

  // O webhook pode chegar poucos segundos depois do redirecionamento do checkout.
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const refreshedUser = await getSessionUser();
  const canAccess = refreshedUser ? hasAccess(refreshedUser) : false;

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh gap-6 px-6 text-center">
      <CheckCircle2 className="h-20 w-20 text-volt-400 animate-pulse" strokeWidth={1.5} />
      <div>
        <h1 className="font-display text-[28px] font-bold text-zinc-50">Sucesso! 🎉</h1>
        <p className="mt-2 text-[14px] text-zinc-400">
          {canAccess
            ? "Sua assinatura foi confirmada. Bem-vindo ao GiroLucro Pro!"
            : "Sua assinatura foi processada. Em alguns momentos você terá acesso completo."}
        </p>
      </div>
      <Link
        href="/"
        className="pressable flex items-center gap-2 rounded-2xl bg-volt-400 px-6 py-3.5 font-display text-[15px] font-bold text-ink-950"
      >
        <Home className="h-5 w-5" />
        Voltar ao app
      </Link>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-dvh gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-volt-400" />
          <p className="text-[13px] text-zinc-500">Confirmando sua assinatura...</p>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
