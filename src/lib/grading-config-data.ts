import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  defaultGradingConfig,
  gradingConfigSchema,
  parseGradingConfig,
  type GradingConfig,
} from "@/lib/grading-config";

/**
 * Lecture et enregistrement de la règle de calcul d'une école.
 *
 * Chaque modification crée une nouvelle version et archive la précédente :
 * un bulletin déjà remis à un parent continue d'être calculé avec la règle
 * de son époque (voir ReportCardIssue et lib/report-card-data.ts).
 */

export interface LoadedGradingConfig {
  /** Version utilisée ; null quand l'école n'a encore rien configuré. */
  id: string | null;
  version: number;
  config: GradingConfig;
  /** Vrai tant que l'école utilise le modèle livré par défaut. */
  isDefault: boolean;
  updatedAt: Date | null;
}

const DEFAULT: Omit<LoadedGradingConfig, "config"> = {
  id: null,
  version: 0,
  isDefault: true,
  updatedAt: null,
};

/** Règle en vigueur dans cette école, ou le modèle par défaut. */
export async function currentGradingConfig(schoolId: string): Promise<LoadedGradingConfig> {
  const row = await prisma.gradingConfig.findFirst({
    where: { schoolId, isCurrent: true },
    orderBy: { version: "desc" },
    select: { id: true, version: true, config: true, createdAt: true },
  });
  if (!row) return { ...DEFAULT, config: defaultGradingConfig() };
  return {
    id: row.id,
    version: row.version,
    config: parseGradingConfig(row.config),
    isDefault: false,
    updatedAt: row.createdAt,
  };
}

/** Une version précise — celle avec laquelle un bulletin a été remis. */
export async function gradingConfigById(
  schoolId: string,
  id: string,
): Promise<LoadedGradingConfig | null> {
  const row = await prisma.gradingConfig.findFirst({
    where: { id, schoolId },
    select: { id: true, version: true, config: true, createdAt: true, isCurrent: true },
  });
  if (!row) return null;
  return {
    id: row.id,
    version: row.version,
    config: parseGradingConfig(row.config),
    isDefault: false,
    updatedAt: row.createdAt,
  };
}

/**
 * Enregistre une nouvelle version de la règle. L'ancienne n'est pas effacée :
 * elle reste rattachée aux bulletins déjà remis.
 */
export async function saveGradingConfig(
  schoolId: string,
  config: GradingConfig,
  userId: string,
): Promise<LoadedGradingConfig> {
  const parsed = gradingConfigSchema.parse(config) as GradingConfig;

  return prisma.$transaction(async (tx) => {
    const last = await tx.gradingConfig.findFirst({
      where: { schoolId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    await tx.gradingConfig.updateMany({ where: { schoolId, isCurrent: true }, data: { isCurrent: false } });
    const row = await tx.gradingConfig.create({
      data: {
        schoolId,
        version: (last?.version ?? 0) + 1,
        config: parsed as unknown as Prisma.InputJsonObject,
        isCurrent: true,
        createdByUserId: userId,
      },
      select: { id: true, version: true, createdAt: true },
    });
    return {
      id: row.id,
      version: row.version,
      config: parsed,
      isDefault: false,
      updatedAt: row.createdAt,
    };
  });
}
