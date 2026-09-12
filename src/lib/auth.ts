import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          schoolId: user.schoolId,
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const admin = await prisma.superAdmin.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!admin) return null;

        const isValid = await bcrypt.compare(credentials.password, admin.passwordHash);
        if (!isValid) return null;

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: "SUPER_ADMIN",
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
        return token;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.schoolId = token.schoolId as string;
      }
      return session;
    },
  },
};
