import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/landing", "/bem-vindo", "/sobre", "/entrar", "/criar-conta", "/esqueci-senha"],
        disallow: [
          "/api",
          "/redefinir-senha",
          "/comparar",
          "/metas",
          "/manutencao",
          "/registrar",
          "/configuracoes",
          "/assinatura",
        ],
      },
    ],
    sitemap: undefined,
  };
}
