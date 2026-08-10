import { withAuth } from "next-auth/middleware";

// Le middleware ne lit pas authOptions : sans ce `pages`, un visiteur non
// connecté est envoyé vers la page NextAuth par défaut au lieu de notre
// écran de connexion.
export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    /*
     * Protège toutes les routes sauf :
     * - "/" (page de présentation publique ; elle redirige elle-même un
     *   utilisateur déjà connecté vers son espace)
     * - /login (page de connexion)
     * - /api/auth (routes NextAuth)
     * - les fichiers statiques et assets Next.js
     *
     * Le « + » final (au lieu de « * ») est ce qui laisse la racine publique :
     * il impose au moins un caractère après le slash.
     */
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)).+)",
  ],
};
