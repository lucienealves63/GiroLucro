import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { contactEmailStatus } from "@/lib/contact";
import { ContactForm } from "@/components/contact-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fale com o GiroLucro — contato, suporte e bugs",
  description:
    "Dúvida sobre o lucro real, bug na Batalha dos Apps, Pix ou compra: fale com o time do GiroLucro. Resposta em até 1 dia útil.",
  openGraph: {
    title: "Fale com o GiroLucro",
    description: "Suporte, bugs, pagamento e ideias de função — direto com quem constrói o app.",
  },
};

export default async function ContatoPage() {
  const [user, email] = await Promise.all([
    getSessionUser().catch(() => null),
    Promise.resolve(contactEmailStatus()),
  ]);

  return (
    <ContactForm
      prefill={user ? { name: user.name, email: user.email } : { name: "", email: "" }}
      emailConfigured={email.configured}
      supportEmail={email.to}
    />
  );
}
