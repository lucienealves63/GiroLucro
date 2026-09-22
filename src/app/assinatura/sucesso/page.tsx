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
  const firstName = (refreshedUser?.name ?? "").split(" ")[0];

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh gap-6 px-6 text-center">
      <CheckCircle2 className="h-20 w-20 text-volt-400 animate-pulse" strokeWidth={1.5} />
      <div>
        <h1 className="font-display text-[28px] font-bold text-zinc-50">
          {canAccess ? `${firstName ? `${firstName}, ` : ""}pagamento confirmado! 🎉` : "Quase lá!"}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-zinc-400">
          {canAccess
            ? "Seu GiroLucro Pro está liberado nesta conta. Foi um pagamento único — sem mensalidade e sem renovação automática."
            : "Estamos confirmando o seu pagamento com o Mercado Pago. Isso costuma levar alguns segundos; você pode atualizar esta página ou tocar em “Já paguei, verificar” na tela de assinatura."}
        </p>
        <p className="mt-3 text-[12.5px] leading-relaxed text-zinc-500">
          {canAccess
            ? "Enviamos o recibo para o e-mail da sua conta. Ele também fica sempre disponível em Configurações → Minha compra, junto do prazo de arrependimento (7 dias)."
            : "Assim que o pagamento for aprovado, o recibo vai para o e-mail da sua conta e o Pro libera automaticamente."}
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <Link
          href="/"
          className="pressable flex items-center gap-2 rounded-2xl bg-volt-400 px-6 py-3.5 font-display text-[15px] font-bold text-ink-950"
        >
          <Home className="h-5 w-5" />
          Voltar ao app
        </Link>
        <Link
          href="/configuracoes#minha-compra"
          className="text-[12.5px] font-semibold text-zinc-400 underline underline-offset-4"
        >
          Ver meu recibo e o prazo de reembolso
        </Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-dvh gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-volt-400" />
          <p className="text-[13px] text-zinc-500">Confirmando seu pagamento...</p>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
