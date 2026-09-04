import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/entrar", "/criar-conta"],
        disallow: ["/api", "/comparar", "/metas", "/manutencao", "/registrar", "/configuracoes", "/assinatura"],
      },
    ],
  };
}
