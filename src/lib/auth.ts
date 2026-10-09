import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { basePrisma, prisma } from "@/lib/prisma";
import { LOGIN_PER_ACCOUNT, LOGIN_PER_ADDRESS, clearAttempts, clientAddress, isLimited, recordAttempt } from "@/lib/rate-limit";
import { TOO_MANY_ATTEMPTS } from "@/lib/login-errors";

/**
 * Empreinte bcrypt d'un mot de passe quelconque (même coût que les vraies) :
 * comparée quand l'e-mail est inconnu ou le compte désactivé, pour que la
 * réponse prenne le même temps que pour un vrai compte. Sans elle, le délai
 * révélait quels e-mails ont un compte (≈ 130 ms d'écart mesurés).
 */
const DUMMY_HASH = "$2b$10$N66ljgkQZU8ksa9p.kh2R.OShAIpS6bu5wDPyA/bYEPgpvhez0.RO";

/**
 * Porte d'entrée commune aux deux connexions : au-delà de 5 mots de passe faux
 * pour un e-mail (ou 50 depuis une adresse) en 15 minutes, la connexion est
 * refusée jusqu'à la fin de la fenêtre — même avec le bon mot de passe. Le
 * délai reste celui d'une vraie vérification : rien ne distingue un e-mail
 * connu d'un e-mail inconnu.
 */
async function checkPassword(
  scope: string,
  email: string,
  password: string,
  forwardedFor: string | string[] | undefined,
  findHash: () => Promise<string | null>,
): Promise<boolean> {
  const accountKey = `${scope}:${email}`;
  const addressKey = `login-ip:${clientAddress(forwardedFor)}`;
  if ((await isLimited(accountKey, LOGIN_PER_ACCOUNT)) || (await isLimited(addressKey, LOGIN_PER_ADDRESS))) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw new Error(TOO_MANY_ATTEMPTS);
  }
  const hash = await findHash();
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  if (ok && hash) {
    await clearAttempts(accountKey);
    return true;
  }
  await Promise.all([recordAttempt(accountKey, LOGIN_PER_ACCOUNT), recordAttempt(addressKey, LOGIN_PER_ADDRESS)]);
  return false;
}

export const authOptions: NextAuthOptions = {
  // 7 jours sans visite, puis nouvelle connexion (30 jours auparavant) ; une
  // visite prolonge la session (renouvelée au plus une fois par jour).
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Identifiants",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase().trim();

        const user = await prisma.user.findUnique({ where: { email } });
        const ok = await checkPassword("login", email, credentials.password, req?.headers?.["x-forwarded-for"], async () =>
          user && user.isActive ? user.passwordHash : null,
        );
        if (!ok || !user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          schoolId: user.schoolId,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
    CredentialsProvider({
      id: "super-admin",
      name: "Super Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      /**
       * Table entièrement séparée de `User` (aucune colonne schoolId) : un
       * Super Admin n'appartient à aucune école, et ce provider ne renvoie
       * donc jamais de schoolId — voir la note dans jwt() ci-dessous.
       */
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase().trim();

        const admin = await prisma.superAdmin.findUnique({ where: { email } });
        const ok = await checkPassword("sa-login", email, credentials.password, req?.headers?.["x-forwarded-for"], async () =>
          admin ? admin.passwordHash : null,
        );
        if (!ok || !admin) return null;

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: "SUPER_ADMIN",
          sessionVersion: admin.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    /**
     * Session en JWT, sans adaptateur de base : rien n'est écrit ici. Deux
     * portes d'entrée seulement, et elles ne se croisent jamais — les comptes
     * d'une école (« credentials ») et le compte propriétaire de la plateforme
     * (« super-admin »), qui vivent dans deux tables distinctes.
     */
    async jwt({ token, user, account }) {
      if (user && account?.provider === "credentials") {
        // Toujours présents ici : c'est ce provider qui les fixe dans authorize().
        token.id = user.id;
        token.role = user.role!;
        token.schoolId = user.schoolId!;
        token.sv = user.sessionVersion ?? 0;
        return token;
      }

      if (user && account?.provider === "super-admin") {
        token.id = user.id;
        token.role = "SUPER_ADMIN";
        // Chaîne vide et non `undefined` : un filtre Prisma `{ schoolId:
        // undefined }` est ignoré (retourne TOUTES les écoles) alors qu'un
        // `{ schoolId: "" }` ne matche jamais rien — si du code scopé-école
        // était par erreur atteint avec ce jeton, il échouerait fermé, pas
        // ouvert. En pratique, aucune page école n'accepte ce rôle : ce
        // n'est qu'un filet de sécurité.
        token.schoolId = "";
        token.sv = user.sessionVersion ?? 0;
        return token;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.schoolId = token.schoolId as string;
        session.user.sv = token.sv ?? 0;
      }
      return session;
    },
  },
  events: {
    /**
     * Déconnexion : la version des sessions du compte augmente, et tout
     * cookie émis avant — copié, oublié sur un ordinateur partagé — est
     * refusé dès la requête suivante (requireRole, requireSuperAdmin).
     */
    async signOut({ token }) {
      if (!token?.id) return;
      if (token.role === "SUPER_ADMIN") {
        await basePrisma.superAdmin.updateMany({ where: { id: token.id }, data: { sessionVersion: { increment: 1 } } });
      } else {
        await basePrisma.user.updateMany({ where: { id: token.id }, data: { sessionVersion: { increment: 1 } } });
      }
    },
  },
};
