import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { NotificationPrompt } from "@/components/notification-prompt";
import { ThemeProvider } from "@/components/theme-provider";

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
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08090c" },
    { media: "(prefers-color-scheme: light)", color: "#f4f6f1" },
  ],
  width: "device-width",
  initialScale: 1,
};

const themeBootScript = `
(function(){
  try {
    var t = localStorage.getItem('gl_theme');
    if (t !== 'light' && t !== 'dark') t = 'dark';
    var r = document.documentElement;
    r.dataset.theme = t;
    r.classList.add(t);
    r.style.colorScheme = t;
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${spaceGrotesk.variable}`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="font-sans text-zinc-100 antialiased">
        <ThemeProvider>
          <div className="app-shell relative mx-auto flex min-h-dvh w-full max-w-[460px] flex-col">
            <div className="texture-road pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
            <main className="relative z-10 flex-1 pb-28">{children}</main>
            <BottomNav />
            <ServiceWorkerRegister />
            <NotificationPrompt />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
