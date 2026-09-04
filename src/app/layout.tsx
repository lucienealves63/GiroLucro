import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { ServiceWorkerRegister } from "@/components/sw-register";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GiroLucro — Seu lucro real na pista",
  description:
    "Descubra quanto sobra de verdade no bolso: lucro líquido por hora e por km, comparativo Uber × 99 × iFood × Rappi, manutenção por km, metas e reserva para dias fracos.",
  manifest: "/manifest.webmanifest",
  applicationName: "GiroLucro",
  icons: {
    icon: [{ url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/icons/icon-512.png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GiroLucro",
  },
  openGraph: {
    title: "GiroLucro — Seu lucro real na pista",
    description:
      "Faturamento bruto não é lucro. Descubra o que sobra de verdade e qual app compensa mais: Uber, 99, iFood ou Rappi.",
    locale: "pt_BR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans text-zinc-100 antialiased">
        <div className="app-shell relative mx-auto flex min-h-dvh w-full max-w-[460px] flex-col bg-[#08090c]">
          <div className="texture-road pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
          <main className="relative z-10 flex-1 pb-28">{children}</main>
          <BottomNav />
          <ServiceWorkerRegister />
        </div>
      </body>
    </html>
  );
}
