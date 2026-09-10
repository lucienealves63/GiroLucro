import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import {
  BUILTIN_IDS,
  CUSTOM_COLORS,
  defaultPlatformsList,
  initialsFromLabel,
  parsePlatformsJson,
  serializePlatforms,
  softFromColor,
  uniquePlatformId,
  type PlatformCategory,
  type PlatformMeta,
} from "@/lib/platforms";

export const dynamic = "force-dynamic";

function sanitizePlatformsInput(raw: unknown, current: PlatformMeta[]): PlatformMeta[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0) return defaultPlatformsList();
  if (raw.length > 40) return null;

  const out: PlatformMeta[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    let id = typeof obj.id === "string" ? obj.id.trim().slice(0, 40) : "";
    if (!id) continue;

    const isBuiltin = BUILTIN_IDS.has(id);
    const isCustomId = /^custom_[a-z0-9_]{1,32}$/i.test(id);
    if (!isBuiltin && !isCustomId) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    if (isBuiltin) {
      const base = defaultPlatformsList().find((p) => p.id === id)!;
      out.push({
        ...base,
        enabled: obj.enabled !== false,
        custom: false,
      });
      continue;
    }

    const label =
      typeof obj.label === "string" && obj.label.trim()
        ? obj.label.trim().slice(0, 40)
        : id.replace(/^custom_/, "").replace(/_/g, " ");
    const category: PlatformCategory =
      obj.category === "ride" || obj.category === "delivery" ? obj.category : "delivery";
    const unit =
      typeof obj.unit === "string" && obj.unit.trim()
        ? obj.unit.trim().slice(0, 20)
        : category === "delivery"
          ? "entrega"
          : "corrida";
    const colorRaw = typeof obj.color === "string" ? obj.color.trim() : "";
    const color =
      /^#?[0-9a-fA-F]{6}$/.test(colorRaw)
        ? colorRaw.startsWith("#")
          ? colorRaw
          : `#${colorRaw}`
        : CUSTOM_COLORS[out.length % CUSTOM_COLORS.length];

    out.push({
      id,
      label,
      color,
      soft: softFromColor(color),
      initials: initialsFromLabel(label),
      category,
      unit,
      custom: true,
      enabled: obj.enabled !== false,
    });
  }

  // Garante que built-ins omitidos voltem (desabilitados se o usuário removeu da lista)
  for (const b of defaultPlatformsList()) {
    if (!seen.has(b.id)) {
      out.push({ ...b, enabled: false });
    }
  }

  // Pelo menos um habilitado
  if (!out.some((p) => p.enabled !== false)) {
    const first = out.find((p) => p.id === "outro") ?? out[0];
    if (first) first.enabled = true;
  }

  return out;
}

export async function PUT(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await req.json();
    const num = (v: unknown, min: number, max: number, fallback: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    };

    const current = await getSettings(user.id);
    const currentPlatforms = parsePlatformsJson(current.platformsJson);

    let platformsJson = current.platformsJson;
    if (body.platforms !== undefined) {
      const sanitized = sanitizePlatformsInput(body.platforms, currentPlatforms);
      if (!sanitized) {
        return NextResponse.json({ error: "Lista de apps inválida" }, { status: 400 });
      }
      platformsJson = serializePlatforms(sanitized);
    } else if (body.addPlatform && typeof body.addPlatform === "object") {
      const ap = body.addPlatform as Record<string, unknown>;
      const label =
        typeof ap.label === "string" ? ap.label.trim().slice(0, 40) : "";
      if (label.length < 2) {
        return NextResponse.json({ error: "Nome do app muito curto" }, { status: 400 });
      }
      const category: PlatformCategory =
        ap.category === "ride" ? "ride" : "delivery";
      const unit =
        typeof ap.unit === "string" && ap.unit.trim()
          ? ap.unit.trim().slice(0, 20)
          : category === "delivery"
            ? "entrega"
            : "corrida";
      const colorRaw = typeof ap.color === "string" ? ap.color.trim() : "";
      const color =
        /^#?[0-9a-fA-F]{6}$/.test(colorRaw)
          ? colorRaw.startsWith("#")
            ? colorRaw
            : `#${colorRaw}`
          : CUSTOM_COLORS[currentPlatforms.length % CUSTOM_COLORS.length];
      const id = uniquePlatformId(label, currentPlatforms);
      const next = [
        ...currentPlatforms,
        {
          id,
          label,
          color,
          soft: softFromColor(color),
          initials: initialsFromLabel(label),
          category,
          unit,
          custom: true as const,
          enabled: true,
        },
      ];
      platformsJson = serializePlatforms(next);
    } else if (typeof body.removePlatformId === "string") {
      const rid = body.removePlatformId.trim();
      if (BUILTIN_IDS.has(rid)) {
        // built-in: só desabilita
        const next = currentPlatforms.map((p) =>
          p.id === rid ? { ...p, enabled: false } : p,
        );
        if (!next.some((p) => p.enabled !== false)) {
          return NextResponse.json(
            { error: "Deixe pelo menos um app ativo" },
            { status: 400 },
          );
        }
        platformsJson = serializePlatforms(next);
      } else {
        const next = currentPlatforms.filter((p) => p.id !== rid);
        if (!next.some((p) => p.enabled !== false)) {
          return NextResponse.json(
            { error: "Deixe pelo menos um app ativo" },
            { status: 400 },
          );
        }
        platformsJson = serializePlatforms(next);
      }
    } else if (typeof body.togglePlatformId === "string") {
      const tid = body.togglePlatformId.trim();
      const next = currentPlatforms.map((p) =>
        p.id === tid ? { ...p, enabled: p.enabled === false } : p,
      );
      if (!next.some((p) => p.enabled !== false)) {
        return NextResponse.json(
          { error: "Deixe pelo menos um app ativo" },
          { status: 400 },
        );
      }
      platformsJson = serializePlatforms(next);
    }

    const patch = {
      vehicleType: ["carro", "moto"].includes(body.vehicleType)
        ? body.vehicleType
        : current.vehicleType,
      vehicleName:
        typeof body.vehicleName === "string"
          ? body.vehicleName.slice(0, 40)
          : current.vehicleName,
      kmPerLiter: num(body.kmPerLiter, 1, 100, current.kmPerLiter),
      fuelPrice: num(body.fuelPrice, 0.5, 30, current.fuelPrice),
      maintenancePerKm: num(body.maintenancePerKm, 0, 5, current.maintenancePerKm),
      fuelMode: ["estimate", "actual"].includes(body.fuelMode)
        ? body.fuelMode
        : current.fuelMode,
      monthlyRent: num(body.monthlyRent, 0, 100000, current.monthlyRent),
      monthlyPhone: num(body.monthlyPhone, 0, 100000, current.monthlyPhone),
      monthlyInsurance: num(body.monthlyInsurance, 0, 100000, current.monthlyInsurance),
      monthlyGoal: num(body.monthlyGoal, 0, 1000000, current.monthlyGoal),
      workDaysPerWeek: Math.round(
        num(body.workDaysPerWeek, 1, 7, current.workDaysPerWeek),
      ),
      reservePercent: num(body.reservePercent, 0, 50, current.reservePercent),
      initialOdometer: num(body.initialOdometer, 0, 10_000_000, current.initialOdometer),
      platformsJson,
      updatedAt: new Date(),
    };

    const [row] = await db
      .update(settings)
      .set(patch)
      .where(eq(settings.userId, user.id))
      .returning();
    return NextResponse.json({
      ...row,
      platforms: parsePlatformsJson(row.platformsJson),
    });
  } catch (error) {
    console.error("[settings] PUT:", error);
    return NextResponse.json({ error: "Falha ao salvar" }, { status: 500 });
  }
}
