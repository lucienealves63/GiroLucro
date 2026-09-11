import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { LandingClient } from "@/components/landing-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sobre o GiroLucro — Como funciona a Batalha dos Apps",
  description:
    "GiroLucro mostra seu lucro líquido real descontando combustível, manutenção, custos fixos e espera. Batalha dos Apps revela onde você ganha mais: Uber, 99, iFood, Rappi.",
};

export default async function SobrePage() {
  const user = await getSessionUser();
  return <LandingClient isLogged={!!user} />;
}
