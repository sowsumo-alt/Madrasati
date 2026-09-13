import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Crée (ou met à jour) le compte propriétaire de la plateforme, celui qui ouvre
 * /super-admin.
 *
 * Ce script existe parce que ce compte n'était créé nulle part : il avait été
 * posé à la main une fois, et le jour où la base a disparu, rien ne permettait
 * de le refaire. Un compte qui ne se recrée pas est un compte qu'on perd.
 *
 *   npx tsx scripts/create-super-admin.ts <email> <mot-de-passe> [nom]
 *
 * Relancer le script sur un email existant remplace le mot de passe : c'est
 * aussi la façon de le réinitialiser si on l'a oublié.
 */
const prisma = new PrismaClient();

async function main() {
  const [email, password, ...nameParts] = process.argv.slice(2);
  const name = nameParts.join(" ") || "Administrateur";

  if (!email || !password) {
    console.error("Usage : npx tsx scripts/create-super-admin.ts <email> <mot-de-passe> [nom]");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Le mot de passe doit faire au moins 8 caractères.");
    process.exit(1);
  }

  const normalized = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.superAdmin.findUnique({ where: { email: normalized } });

  await prisma.superAdmin.upsert({
    where: { email: normalized },
    update: { passwordHash, name },
    create: { email: normalized, passwordHash, name },
  });

  console.log(
    existing
      ? `Mot de passe remplacé pour ${normalized}.`
      : `Compte Super Admin créé : ${normalized}`,
  );
  console.log("Connexion : /super-admin/login");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
