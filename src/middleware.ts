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
     * - /login (page de connexion) et /inscription (création d'une école)
     * - /auth/callback (pont Supabase -> next-auth pour "Continuer avec
     *   Google" : le navigateur n'est pas encore authentifié côté next-auth
     *   à ce stade, donc cette page doit rester accessible sans session)
     * - /api/auth (routes NextAuth)
     * - les fichiers statiques et assets Next.js
     *
     * Le « + » final (au lieu de « * ») est ce qui laisse la racine publique :
     * il impose au moins un caractère après le slash.
     */
    "/((?!login|inscription|auth/callback|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)).+)",
  ],
};
