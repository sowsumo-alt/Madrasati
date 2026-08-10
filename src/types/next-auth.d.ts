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
