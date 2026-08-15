import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    // Optionnels : une identité Google fraîchement vérifiée par Supabase
    // (provider "supabase-google") n'a pas encore de role/schoolId tant que
    // le directeur n'a pas créé son école (état "pending", voir jwt() dans
    // src/lib/auth.ts).
    role?: string;
    schoolId?: string;
  }

  interface Session {
    user: {
      id: string;
      role: string;
      schoolId: string;
      /** Vrai pour une identité Google authentifiée qui n'a pas encore créé
       *  d'école — role/schoolId sont alors absents à l'exécution. */
      pending?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    schoolId: string;
    pending?: boolean;
  }
}
