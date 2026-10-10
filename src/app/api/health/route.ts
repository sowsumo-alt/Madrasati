import { basePrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Pour un moniteur de disponibilité : 200 si l'application répond et joint
 * la base, 503 sinon. Aucune donnée, aucun détail d'erreur.
 */
export async function GET() {
  try {
    await basePrisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
