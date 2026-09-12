import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    // Optionnels dans le type de next-auth, mais toujours fixés par nos deux
    // providers : un compte d'école porte son rôle et son école, le compte
    // propriétaire porte le rôle SUPER_ADMIN et une école vide.
    role?: string;
    schoolId?: string;
  }

  interface Session {
    user: {
      id: string;
      role: string;
      schoolId: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    schoolId: string;
  }
}
