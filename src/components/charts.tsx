"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { brl } from "@/lib/format";

export interface WeekBarDatum {
  label: string;
  net: number;
  gross: number;
  isToday: boolean;
  hasData: boolean;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: WeekBarDatum }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d.hasData)
    return (
      <div className="rounded-xl border border-white/10 bg-[#10131a] px-3 py-2 text-[11px] text-zinc-500 shadow-xl">
        Sem registros
      </div>
    );
  return (
    <div className="rounded-xl border border-white/10 bg-[#10131a] px-3 py-2 text-[11px] shadow-xl">
      <p className="font-bold text-volt-300">Líquido {brl(d.net)}</p>
      <p className="text-zinc-400">Bruto {brl(d.gross)}</p>
    </div>
  );
}

export function WeekBars({ data }: { data: WeekBarDatum[] }) {
  const max = Math.max(...data.map((d) => Math.abs(d.net)), 1);
  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="28%">
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#63636b", fontSize: 10, fontWeight: 700 }}
            dy={6}
          />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltip />} />
          <Bar dataKey="net" radius={[5, 5, 5, 5]} minPointSize={3}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={
                  !d.hasData
                    ? "rgba(255,255,255,0.05)"
                    : d.net >= 0
                      ? d.isToday
                        ? "#b8f53c"
                        : `rgba(184,245,60,${0.28 + 0.45 * (Math.abs(d.net) / max)})`
                      : "#fb7185"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
