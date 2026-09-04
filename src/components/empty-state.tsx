"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Database, Loader2 } from "lucide-react";

export function FirstRunEmpty() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  const seed = () => {
    setError(false);
    start(async () => {
      const res = await fetch("/api/seed", { method: "POST" });
      if (res.ok) router.refresh();
      else setError(true);
    });
  };

  return (
    <div className="flex flex-col items-center px-6 pb-10 pt-4 text-center">
      <div className="relative mb-2 h-44 w-44 overflow-hidden rounded-[2rem] border border-white/10">
        <Image
          src="/images/moto-night.png"
          alt="Motoboy na estrada à noite"
          fill
          className="object-cover"
          priority
        />
      </div>
      <h2 className="font-display text-[22px] font-bold leading-tight text-zinc-50">
        Descubra quanto sobra
        <br />
        <span className="text-volt-400">de verdade no bolso</span>
      </h2>
      <p className="mt-2.5 max-w-[300px] text-[13px] leading-relaxed text-zinc-400">
        Faturamento bruto da Uber, 99, iFood ou Rappi não é lucro. Registre corridas e
        baterias de entregas — a gente desconta combustível, manutenção, espera em
        loja e marmita, automaticamente.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2.5">
        <a
          href="/registrar"
          className="pressable flex w-full items-center justify-center rounded-2xl bg-volt-400 py-3.5 font-display text-[15px] font-bold text-ink-950"
        >
          Fazer meu primeiro lançamento
        </a>
        <button
          onClick={seed}
          disabled={pending}
          className="pressable flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 text-[13.5px] font-semibold text-zinc-300 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Database className="h-4 w-4" />
          )}
          {pending ? "Gerando..." : "Explorar com dados de exemplo"}
        </button>
        {error && (
          <p className="text-[12px] text-rose-400">
            Não foi possível gerar os dados. Tente novamente.
          </p>
        )}
      </div>
    </div>
  );
}
