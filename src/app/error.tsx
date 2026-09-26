"use client";

import { useEffect, useState } from "react";

/**
 * Tela de erro amigável: em vez da mensagem genérica do Next.js, deixa a
 * pessoa tentar de novo ou sair da conta (limpa a sessão) sem ficar presa.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* segue para /entrar mesmo assim */
    }
    window.location.href = "/entrar";
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Algo deu errado</h1>
      <p className="opacity-80">
        Não conseguimos carregar esta página agora. Tente de novo em alguns
        segundos. Se continuar, saia da conta e entre novamente.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            reset();
            window.location.reload();
          }}
          className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-black"
        >
          Tentar de novo
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={logout}
          className="rounded-xl border border-white/20 px-5 py-3 font-semibold"
        >
          {busy ? "Saindo…" : "Sair e entrar de novo"}
        </button>
      </div>
      {error.digest ? (
        <p className="text-xs opacity-50">Código do erro: {error.digest}</p>
      ) : null}
      <a href="/contato" className="text-sm underline opacity-70">
        Falar com o suporte
      </a>
    </main>
  );
}
