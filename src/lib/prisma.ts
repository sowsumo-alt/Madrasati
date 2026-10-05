import { PrismaClient } from "@prisma/client";
import { WRITE_OPERATIONS, guardWrite } from "@/lib/write-guard";

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined;
};

/**
 * Client sans contrôle d'accès : réservé aux écritures du système lui-même
 * (démarrage de l'essai d'une école…), jamais à une action d'un utilisateur.
 */
export const basePrisma = globalForPrisma.prismaBase ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBase = basePrisma;
}

/**
 * Le client de l'application. Toute écriture demandée pendant une action
 * serveur passe d'abord par le contrôle d'accès (lib/write-guard.ts) : un
 * directeur en lecture seule ne modifie rien, quelle que soit l'action.
 *
 * Typé comme un PrismaClient ordinaire : l'extension ne fait qu'intercepter
 * les requêtes, sans rien changer à leur forme, et le code de l'application
 * (fonctions qui reçoivent une transaction) garde ses types habituels.
 *
 * Dans le navigateur (module importé par erreur via un composant client), pas
 * d'extension : le client y est inutilisable de toute façon, et la page ne
 * doit pas planter au chargement.
 */
export const prisma = (typeof window !== "undefined" ? basePrisma : basePrisma.$extends({
  name: "controle-ecriture",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (WRITE_OPERATIONS.has(operation)) {
          await guardWrite(model, args, (userId) =>
            basePrisma.user.findUnique({
              where: { id: userId },
              select: { role: true, access: true, isActive: true },
            }),
          );
        }
        return query(args);
      },
    },
  },
})) as unknown as PrismaClient;
