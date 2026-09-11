import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { LandingClient } from "@/components/landing-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bem-vindo ao GiroLucro — Lucro real na pista",
  description:
    "Descubra seu lucro líquido real por hora e por km. Batalha dos Apps compara Uber, 99, iFood, Rappi. 7 dias grátis, R$19,90 vitalício.",
};

export default async function BemVindoPage() {
  const user = await getSessionUser();
  return <LandingClient isLogged={!!user} />;
}
