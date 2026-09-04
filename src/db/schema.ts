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
    planCycle: text("plan_cycle"), // monthly | yearly
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    billingCustomerId: text("billing_customer_id"), // id no gateway (Stripe/Mercado Pago)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export type User = typeof users.$inferSelect;

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
