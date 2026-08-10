export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    /*
     * Protège toutes les routes sauf :
     * - /login (page de connexion)
     * - /api/auth (routes NextAuth)
     * - les fichiers statiques et assets Next.js
     */
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)).*)",
  ],
};
