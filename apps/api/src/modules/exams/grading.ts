import { and, asc, desc, eq } from "drizzle-orm";
import type { DB } from "../../lib/types";
import { gradingScaleBands, gradingScales } from "../../db/schema";

export type GradingBand = {
  minPercent: number;
  maxPercent: number;
  grade: string;
  gpa: number;
  remark: string | null;
};

export type GradingScale = {
  id: string;
  name: string;
  bands: GradingBand[];
};

/** Loads the tenant's default grading scale, falling back to the oldest one. */
export async function loadGradingScale(db: DB, orgId: string): Promise<GradingScale | null> {
  const [scale] = await db
    .select({ id: gradingScales.id, name: gradingScales.name })
    .from(gradingScales)
    .where(eq(gradingScales.organisationId, orgId))
    .orderBy(desc(gradingScales.isDefault), asc(gradingScales.createdAt))
    .limit(1);
  if (!scale) return null;

  const bands = await db
    .select({
      minPercent: gradingScaleBands.minPercent,
      maxPercent: gradingScaleBands.maxPercent,
      grade: gradingScaleBands.grade,
      gpa: gradingScaleBands.gpa,
      remark: gradingScaleBands.remark,
    })
    .from(gradingScaleBands)
    .where(and(eq(gradingScaleBands.organisationId, orgId), eq(gradingScaleBands.gradingScaleId, scale.id)))
    .orderBy(desc(gradingScaleBands.minPercent));

  return {
    id: scale.id,
    name: scale.name,
    bands: bands.map((band) => ({
      minPercent: Number(band.minPercent),
      maxPercent: Number(band.maxPercent),
      grade: band.grade,
      gpa: Number(band.gpa),
      remark: band.remark,
    })),
  };
}

/** Resolves a 0–100 percentage to a grade band. */
export function resolveBand(percentage: number | null, bands: GradingBand[]) {
  if (percentage === null || !Number.isFinite(percentage) || !bands.length) return null;
  const value = round2(Math.min(100, Math.max(0, percentage)));
  return (
    bands.find((band) => value >= band.minPercent && value <= band.maxPercent) ??
    bands.find((band) => value >= band.minPercent) ??
    bands[bands.length - 1] ??
    null
  );
}

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}
