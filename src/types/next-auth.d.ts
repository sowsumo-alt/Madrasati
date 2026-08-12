import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: string;
    schoolId: string;
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
