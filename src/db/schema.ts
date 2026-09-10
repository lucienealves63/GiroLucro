import {
  boolean,
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
    // assinatura: trialing | active | canceled
    planStatus: text("plan_status").notNull().default("trialing"),
    planCycle: text("plan_cycle"), // lifetime | monthly | yearly (legado)
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    billingCustomerId: text("billing_customer_id"), // id no gateway (Stripe/Mercado Pago)
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
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  date: text("date").notNull(), // yyyy-MM-dd
  type: text("type").notNull(), // combustivel | alimentacao | manutencao | outro
  amount: numeric("amount", { precision: 10, scale: 2, mode: "number" }).notNull(),
  odometer: numeric("odometer", { precision: 10, scale: 1, mode: "number" }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

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
