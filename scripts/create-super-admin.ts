import { createInterface } from "node:readline";
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
 *   npx tsx scripts/create-super-admin.ts            (mot de passe oublié : le compte existant)
 *   npx tsx scripts/create-super-admin.ts <email>    (créer ou réinitialiser ce compte)
 *
 * Le mot de passe est demandé au clavier, masqué, deux fois : il ne reste ni
 * dans l'historique du terminal ni dans une conversation. L'ancienne forme
 * (<email> <mot-de-passe> [nom]) marche encore, pour une installation automatisée.
 */
const prisma = new PrismaClient();

// Réponses envoyées d'avance (entrée redirigée) : un seul lecteur pour toutes les questions.
let piped: AsyncIterator<string> | null = null;

/** Une ligne tapée au clavier ; masquée par des points quand `hidden`. */
async function ask(question: string, hidden = false): Promise<string> {
  const stdin = process.stdin;
  process.stdout.write(question);
  if (!stdin.isTTY) {
    piped ??= createInterface({ input: stdin, terminal: false })[Symbol.asyncIterator]();
    const { value } = await piped.next();
    process.stdout.write("\n");
    return hidden ? String(value ?? "") : String(value ?? "").trim();
  }
  if (!hidden) {
    const rl = createInterface({ input: stdin, terminal: false });
    return new Promise((resolve) =>
      rl.once("line", (line) => {
        rl.close();
        resolve(line.trim());
      }),
    );
  }
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  let value = "";
  return new Promise((resolve) => {
    const finish = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          finish();
          return resolve(value);
        }
        if (ch === "\u0003") {
          finish();
          process.exit(1);
        }
        if (ch === "\u007f" || ch === "\b") {
          if (value) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        value += ch;
        process.stdout.write("•");
      }
    };
    stdin.on("data", onData);
  });
}

/** La base visée, sans rien de secret : « ep-mute-poetry-ayyy50ik ». */
function databaseLabel() {
  const url = process.env.DATABASE_URL ?? "";
  // Seulement après « @ » : l'identifiant et le mot de passe sont avant.
  const afterAt = decodeURIComponent(url.slice(url.lastIndexOf("@") + 1));
  const endpoint = /ep-[a-z0-9]+(?:-[a-z0-9]+)*/.exec(afterAt)?.[0];
  return endpoint ? endpoint.replace(/-pooler$/, "") : afterAt.split(/[.:/?]/)[0] || "inconnue";
}

async function main() {
  const [emailArg, passwordArg, ...nameParts] = process.argv.slice(2);
  let email = emailArg?.toLowerCase().trim();

  // Sans e-mail : le compte Super Admin existant (le cas du mot de passe oublié).
  if (!email) {
    const admins = await prisma.superAdmin.findMany({ select: { email: true } });
    if (admins.length !== 1) {
      console.error(
        admins.length === 0
          ? "Aucun compte Super Admin dans cette base. Usage : npx tsx scripts/create-super-admin.ts <email> [nom]"
          : `Plusieurs comptes Super Admin : ${admins.map((a) => a.email).join(", ")}. Précisez lequel : npx tsx scripts/create-super-admin.ts <email>`,
      );
      process.exit(1);
    }
    email = admins[0].email;
  }

  const existing = await prisma.superAdmin.findUnique({ where: { email }, select: { name: true } });
  let name = nameParts.join(" ").trim() || null;

  console.log(`Base : ${databaseLabel()}`);
  console.log(existing ? `Compte : ${email} — le mot de passe va être remplacé.` : `Compte à créer : ${email}`);

  // Ancienne forme : le mot de passe en argument (installation automatisée).
  let password = passwordArg ?? "";
  if (!password) {
    if (!existing) name = (await ask("Nom affiché (facultatif) : ")) || null;
    password = await ask("Nouveau mot de passe (8 caractères minimum) : ", true);
    const again = await ask("Retapez-le : ", true);
    if (password !== again) {
      console.error("Les deux mots de passe ne sont pas identiques : rien n'a été changé.");
      process.exit(1);
    }
    if (password.length < 8) {
      console.error("Le mot de passe doit faire au moins 8 caractères : rien n'a été changé.");
      process.exit(1);
    }
    const ok = await ask("Confirmer ? (o/n) : ");
    if (!/^o(ui)?$/i.test(ok)) {
      console.log("Annulé : rien n'a été changé.");
      process.exit(0);
    }
  }
  if (password.length < 8) {
    console.error("Le mot de passe doit faire au moins 8 caractères : rien n'a été changé.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.superAdmin.upsert({
    where: { email },
    // Le nom n'est changé que s'il est donné : réinitialiser un mot de passe ne renomme pas le compte.
    update: { passwordHash, ...(name ? { name } : {}) },
    create: { email, passwordHash, name: name ?? "Administrateur" },
  });

  console.log(existing ? `Mot de passe remplacé pour ${email}.` : `Compte Super Admin créé : ${email}`);
  console.log("Connexion : /super-admin/login");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
