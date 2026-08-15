import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase";

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
      id: "supabase-google",
      name: "Google",
      credentials: {
        accessToken: { label: "Token", type: "text" },
      },
      /**
       * L'identité Google est vérifiée par Supabase Auth (page /inscription,
       * bouton "Continuer avec Google"). Le navigateur nous transmet le jeton
       * d'accès Supabase obtenu après ce flux ; on le revalide ici auprès de
       * Supabase pour en extraire l'email/nom, sans jamais faire confiance à
       * une valeur envoyée telle quelle par le client.
       */
      async authorize(credentials) {
        if (!credentials?.accessToken) return null;

        const supabase = createSupabaseServerClient();
        const { data, error } = await supabase.auth.getUser(credentials.accessToken);
        if (error || !data.user?.email) return null;

        return {
          id: data.user.id,
          email: data.user.email,
          name:
            (data.user.user_metadata?.full_name as string | undefined) ??
            (data.user.user_metadata?.name as string | undefined) ??
            data.user.email,
        };
      },
    }),
  ],
  callbacks: {
    /**
     * Pas d'adaptateur de base pour next-auth (session en JWT) : une
     * connexion Google n'écrit jamais de ligne en base ici. Si l'email
     * correspond à un compte existant, c'est une connexion normale. Sinon,
     * l'identité Google reste uniquement dans le jeton (pending: true) —
     * l'utilisateur doit d'abord créer son école sur /inscription/ecole.
     * Une fois cette création faite, le client appelle useSession().update(),
     * ce qui déclenche la branche trigger === "update" ci-dessous.
     */
    async jwt({ token, user, account, trigger }) {
      if (user && account?.provider === "credentials") {
        // Toujours présents ici : c'est ce provider qui les fixe dans authorize().
        token.id = user.id;
        token.role = user.role!;
        token.schoolId = user.schoolId!;
        delete token.pending;
        return token;
      }

      if (user && account?.provider === "supabase-google" && user.email) {
        const existing = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
        });
        if (existing) {
          token.id = existing.id;
          token.role = existing.role;
          token.schoolId = existing.schoolId;
          delete token.pending;
        } else {
          token.pending = true;
          token.email = user.email;
          token.name = user.name;
        }
        return token;
      }

      if (trigger === "update" && token.pending && token.email) {
        const created = await prisma.user.findUnique({
          where: { email: (token.email as string).toLowerCase() },
        });
        if (created) {
          token.id = created.id;
          token.role = created.role;
          token.schoolId = created.schoolId;
          delete token.pending;
        }
        return token;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.schoolId = token.schoolId as string;
        session.user.pending = token.pending === true;
      }
      return session;
    },
  },
};
