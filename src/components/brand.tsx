export function Logo({ size = 34 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="relative flex items-center justify-center rounded-xl bg-volt-400 shadow-[0_0_24px_rgba(184,245,60,0.35)]"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 24 24"
          width={size * 0.62}
          height={size * 0.62}
          fill="none"
          stroke="#08090c"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 17c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-4.5 6-6" />
          <path d="M17 7h3v3" />
        </svg>
      </div>
      <div className="leading-none">
        <p className="font-display text-[17px] font-bold tracking-tight text-zinc-50">
          Giro<span className="text-volt-400">Lucro</span>
        </p>
        <p className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Lucro real na pista
        </p>
      </div>
    </div>
  );
}
