import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Usuários da plataforma (SaaS multi-usuário).
 */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    // assinatura: trialing | active | canceled | pending_payment | deleted
    planStatus: text("plan_status").notNull().default("trialing"),
    planCycle: text("plan_cycle"), // lifetime | monthly | yearly (legado)
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    billingCustomerId: text("billing_customer_id"), // id no gateway (Stripe/Mercado Pago)
    /* -------- aceite dos documentos jurídicos (LGPD art. 8º / CDC) -------- */
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    termsVersion: text("terms_version"),
    privacyAcceptedAt: timestamp("privacy_accepted_at", { withTimezone: true }),
    privacyVersion: text("privacy_version"),
    /* ---------------- pagamento único (Mercado Pago) --------------------- */
    paymentId: text("payment_id"), // id da transação no provedor
    paymentProvider: text("payment_provider"), // mercado_pago | pix | demo
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentAmount: numeric("payment_amount", { precision: 10, scale: 2, mode: "number" }),
    // approved | pending | rejected | refunded | charged_back
    paymentStatus: text("payment_status"),
    /* ------------- arrependimento / reembolso (CDC art. 49) ------------- */
    refundRequestedAt: timestamp("refund_requested_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    // none | requested | processing | refunded | denied | manual
    refundStatus: text("refund_status").default("none"),
    /* --------- exclusão de conta (anonimização p/ guarda fiscal) --------- */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export type User = typeof users.$inferSelect;

/**
 * Eventos processados dos gateways de pagamento.
 * A chave única impede que reenvios de webhook renovem uma assinatura duas vezes.
 */
export const billingEvents = pgTable(
  "billing_events",
  {
    id: serial("id").primaryKey(),
    provider: text("provider").notNull().default("mercado_pago"),
    eventKey: text("event_key").notNull(),
    eventType: text("event_type").notNull(),
    resourceId: text("resource_id").notNull(),
    userId: integer("user_id"),
    status: text("status").notNull().default("processed"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("billing_events_provider_key_idx").on(t.provider, t.eventKey)],
);

export type BillingEvent = typeof billingEvents.$inferSelect;

/**
 * Sessões de login (cookie httpOnly).
 */
export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;

/**
 * Tokens de recuperação de senha.
 * Apenas o hash SHA-256 é salvo: se o banco vazar, o link não pode ser reconstruído.
 */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("password_reset_token_hash_idx").on(t.tokenHash)],
);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

/**
 * Configurações do veículo e financeiras (uma por usuário).
 */
export const settings = pgTable(
  "settings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
  // Veículo
  vehicleType: text("vehicle_type").notNull().default("moto"), // carro | moto
  vehicleName: text("vehicle_name").notNull().default(""),
  kmPerLiter: numeric("km_per_liter", { precision: 8, scale: 2, mode: "number" })
    .notNull()
    .default(35),
  fuelPrice: numeric("fuel_price", { precision: 8, scale: 2, mode: "number" })
    .notNull()
    .default(5.79),
  maintenancePerKm: numeric("maintenance_per_km", {
    precision: 8,
    scale: 3,
    mode: "number",
  })
    .notNull()
    .default(0.15),
  fuelMode: text("fuel_mode").notNull().default("estimate"), // estimate | actual
  // Custos fixos mensais
  monthlyRent: numeric("monthly_rent", { precision: 10, scale: 2, mode: "number" })
    .notNull()
    .default(0),
  monthlyPhone: numeric("monthly_phone", { precision: 10, scale: 2, mode: "number" })
    .notNull()
    .default(59.9),
  monthlyInsurance: numeric("monthly_insurance", {
    precision: 10,
    scale: 2,
    mode: "number",
  })
    .notNull()
    .default(0),
  // Metas e reserva
  monthlyGoal: numeric("monthly_goal", { precision: 10, scale: 2, mode: "number" })
    .notNull()
    .default(3500),
  workDaysPerWeek: integer("work_days_per_week").notNull().default(6),
  reservePercent: numeric("reserve_percent", { precision: 5, scale: 2, mode: "number" })
    .notNull()
    .default(10),
  initialOdometer: numeric("initial_odometer", {
    precision: 10,
    scale: 1,
    mode: "number",
  })
    .notNull()
    .default(0),
  /** JSON das plataformas de ganho (built-in + custom). null = padrão. */
  platformsJson: text("platforms_json"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("settings_user_idx").on(t.userId)],
);

export type Settings = typeof settings.$inferSelect;

/**
 * Lançamentos de trabalho (corridas / turnos por plataforma).
 */
export const workEntries = pgTable("work_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  date: text("date").notNull(), // yyyy-MM-dd
  platform: text("platform").notNull(), // uber | 99 | ifood | outro
  gross: numeric("gross", { precision: 10, scale: 2, mode: "number" }).notNull(),
  hours: numeric("hours", { precision: 6, scale: 2, mode: "number" })
    .notNull()
    .default(0),
  km: numeric("km", { precision: 8, scale: 1, mode: "number" }).notNull().default(0),
  quantity: integer("quantity").notNull().default(1), // nº de corridas/entregas
  waitMinutes: numeric("wait_minutes", { precision: 6, scale: 1, mode: "number" })
    .notNull()
    .default(0), // tempo parado (restaurante, fila etc.)
  settled: boolean("settled").notNull().default(false), // repasse já caiu na conta?
  period: text("period").notNull().default("tarde"), // madrugada | manha | tarde | noite
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type WorkEntry = typeof workEntries.$inferSelect;

/**
 * Despesas do dia a dia.
 */
export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    date: text("date").notNull(), // yyyy-MM-dd
    type: text("type").notNull(), // combustivel | alimentacao | manutencao | outro
    amount: numeric("amount", { precision: 10, scale: 2, mode: "number" }).notNull(),
    odometer: numeric("odometer", { precision: 10, scale: 1, mode: "number" }),
    /**
     * Posto onde o combustível foi comprado (só usado em type=combustivel).
     * Guardamos o nome como digitado; a comparação entre postos usa a chave
     * normalizada de `stationKey()` (minúsculas, sem acento) — assim
     * "Posto Shell" e "posto shell" são o mesmo posto.
     */
    station: text("station"),
    /** Litros abastecidos — permite R$/litro e km/l por posto. */
    liters: numeric("liters", { precision: 8, scale: 2, mode: "number" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("expenses_user_station_idx").on(t.userId, t.station)],
);

export type Expense = typeof expenses.$inferSelect;

/**
 * Manutenções realizadas (com intervalo de km para alertas).
 */
export const maintenances = pgTable("maintenances", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  type: text("type").notNull(), // oleo | pneus | freios | relacao | revisao | outro
  date: text("date").notNull(), // yyyy-MM-dd
  kmDone: numeric("km_done", { precision: 10, scale: 1, mode: "number" }).notNull(),
  cost: numeric("cost", { precision: 10, scale: 2, mode: "number" })
    .notNull()
    .default(0),
  intervalKm: numeric("interval_km", { precision: 10, scale: 1, mode: "number" })
    .notNull()
    .default(0), // 0 = sem rastreamento
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Maintenance = typeof maintenances.$inferSelect;

/**
 * Subscriptions de push notifications (Web Push API).
 * Um usuário pode ter múltiplos dispositivos/navegadores.
 */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  auth: text("auth").notNull(), // chave de autenticação
  p256dh: text("p256dh").notNull(), // chave pública ECDH
  userAgent: text("user_agent"), // navegador/device
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;

/**
 * Log de notificações enviadas (para analytics e retenção).
 */
export const notificationLogs = pgTable("notification_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(), // manutencao_urgente | trial_expira | meta_diaria | outro
  title: text("title").notNull(),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  opened: boolean("opened").notNull().default(false),
});

/**
 * Visitas às páginas públicas e do app (base do painel de acessos).
 *
 * Não guardamos IP nem cookies de terceiros: o identificador é um UUID
 * de primeiro domínio (`gl_vid`) gerado no próprio navegador do visitante.
 * `day` é gravado já no fuso de São Paulo para os gráficos fecharem com o
 * dia "de calendário" do dono do app (e não depender do fuso do servidor).
 */
export const pageViews = pgTable(
  "page_views",
  {
    id: serial("id").primaryKey(),
    visitorId: text("visitor_id").notNull(),
    sessionId: text("session_id").notNull(), // uma aba/janela = uma visita
    path: text("path").notNull(), // "/comparar" (sem query string)
    referrer: text("referrer"), // URL de origem, truncada
    referrerDomain: text("referrer_domain"), // "google.com.br" | null = acesso direto
    channel: text("channel").notNull().default("direto"), // direto | busca | social | anuncio | email | referencia | interno
    source: text("source"), // utm_source
    medium: text("medium"), // utm_medium
    campaign: text("campaign"), // utm_campaign
    deviceType: text("device_type").notNull().default("desktop"), // mobile | tablet | desktop
    browser: text("browser"),
    os: text("os"),
    country: text("country"), // ISO-2 (x-vercel-ip-country)
    language: text("language"), // Accept-Language
    userId: integer("user_id"), // preenchido quando o visitante já tem sessão
    dwellMs: integer("dwell_ms").notNull().default(0), // tempo na página (beacon de saída)
    isBot: boolean("is_bot").notNull().default(false),
    day: text("day").notNull(), // yyyy-MM-dd em America/Sao_Paulo
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("page_views_day_idx").on(t.day),
    index("page_views_created_idx").on(t.createdAt),
    index("page_views_visitor_day_idx").on(t.visitorId, t.day),
    index("page_views_user_idx").on(t.userId),
  ],
);

export type PageView = typeof pageViews.$inferSelect;

/**
 * Mensagens recebidas pela página de contato (/contato).
 *
 * Sempre são gravadas no banco — o e-mail via Resend é uma cópia. Assim,
 * mesmo sem RESEND_API_KEY configurada a mensagem não se perde
 * (dá para ler tudo no painel em /admin?aba=contato).
 */
export const contactMessages = pgTable(
  "contact_messages",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    topic: text("topic").notNull().default("duvida"), // duvida | bug | pagamento | parceria | outro
    body: text("body").notNull(),
    status: text("status").notNull().default("novo"), // novo | respondido | arquivado
    userId: integer("user_id"), // autor logado, se houver
    visitorId: text("visitor_id"), // liga a mensagem às visitas da pessoa
    sourcePath: text("source_path"), // página de onde a pessoa escreveu
    replyToEmail: boolean("reply_to_email").notNull().default(false), // quer resposta por e-mail
    ipHash: text("ip_hash"), // hash do IP — usado só para rate limit
    userAgent: text("user_agent"),
    emailSent: boolean("email_sent").notNull().default(false),
    emailError: text("email_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
  },
  (t) => [
    index("contact_messages_created_idx").on(t.createdAt),
    index("contact_messages_status_idx").on(t.status),
    index("contact_messages_ip_idx").on(t.ipHash, t.createdAt),
  ],
);

export type ContactMessage = typeof contactMessages.$inferSelect;

/**
 * Histórico de aceite dos documentos jurídicos (Termos de Uso / Política de
 * Privacidade). Guardamos apenas documento + versão + data/hora + origem —
 * nunca o texto inteiro do documento.
 *
 * As colunas equivalentes em `users` guardam o aceite vigente (último), para
 * consulta rápida; esta tabela é o histórico auditável.
 */
export const legalAcceptances = pgTable(
  "legal_acceptances",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    documentType: text("document_type").notNull(), // terms | privacy
    documentVersion: text("document_version").notNull(), // "1.0"
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
    source: text("source").notNull().default("signup"), // signup | settings | checkout
  },
  (t) => [
    index("legal_acceptances_user_idx").on(t.userId),
    index("legal_acceptances_doc_idx").on(t.documentType, t.documentVersion),
  ],
);

export type LegalAcceptance = typeof legalAcceptances.$inferSelect;

/**
 * Registro interno de solicitações de titular de dados (LGPD art. 18):
 * exportação, correção, exclusão, reembolso/arrependimento.
 *
 * Guardamos o mínimo para auditoria: tipo, status, datas e uma observação
 * curta. Nada de nome, e-mail, telefone ou conteúdo de mensagem.
 */
export const dataSubjectRequests = pgTable(
  "data_subject_requests",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"), // pode ficar órfão após exclusão da conta
    requestType: text("request_type").notNull(), // export | deletion | refund | correction | consent
    status: text("status").notNull().default("received"), // received | processing | done | denied
    channel: text("channel").notNull().default("app"), // app | email | admin
    note: text("note"), // observação técnica, sem dado pessoal
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("data_subject_requests_user_idx").on(t.userId),
    index("data_subject_requests_type_idx").on(t.requestType, t.createdAt),
  ],
);

export type DataSubjectRequest = typeof dataSubjectRequests.$inferSelect;
