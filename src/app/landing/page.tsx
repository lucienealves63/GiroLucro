import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { LandingClient } from "@/components/landing-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "GiroLucro — Descubra onde você realmente ganha mais | Batalha dos Apps",
  description:
    "Faturamento bruto não é lucro. GiroLucro calcula seu lucro líquido por hora e por km, descontando combustível, manutenção, custos fixos e tempo de espera. Compare Uber × 99 × iFood × Rappi na Batalha dos Apps. 7 dias grátis, R$19,90 vitalício.",
  openGraph: {
    title: "GiroLucro — Seu lucro real na pista",
    description:
      "Pare de trabalhar no escuro. Veja R$/hora líquido por app na Batalha dos Apps. Uber, 99, iFood, Rappi lado a lado. 7 dias grátis, R$19,90 vitalício sem mensalidade.",
    type: "website",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "GiroLucro — Batalha dos Apps",
    description: "Descubra onde você ganha mais por hora. Uber × 99 × iFood × Rappi. Lucro líquido real.",
  },
};

export default async function LandingPage() {
  const user = await getSessionUser();

  return <LandingClient isLogged={!!user} />;
}
