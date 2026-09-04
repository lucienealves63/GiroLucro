import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  expenses,
  maintenances,
  settings,
  workEntries,
  type Expense,
  type Maintenance,
  type Settings,
  type WorkEntry,
} from "@/db/schema";

export async function getSettings(userId: number): Promise<Settings> {
  const rows = await db.select().from(settings).where(eq(settings.userId, userId));
  if (rows[0]) return rows[0];
  const [created] = await db.insert(settings).values({ userId }).returning();
  return created;
}

export interface AppData {
  settings: Settings;
  entries: WorkEntry[];
  expenses: Expense[];
  maintenances: Maintenance[];
}

export async function getAppData(userId: number): Promise<AppData> {
  const [s, e, x, m] = await Promise.all([
    getSettings(userId),
    db
      .select()
      .from(workEntries)
      .where(eq(workEntries.userId, userId))
      .orderBy(desc(workEntries.id)),
    db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId))
      .orderBy(desc(expenses.id)),
    db
      .select()
      .from(maintenances)
      .where(eq(maintenances.userId, userId))
      .orderBy(desc(maintenances.id)),
  ]);
  return { settings: s, entries: e, expenses: x, maintenances: m };
}
