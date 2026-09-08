import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/entrar", "/criar-conta", "/esqueci-senha"],
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
  };
}
