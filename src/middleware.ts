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
     * - "/" (elle redirige elle-même : vers /login si personne n'est
     *   connecté, vers son espace si quelqu'un l'est — la laisser publique
     *   évite un aller-retour de redirections avec le middleware)
     * - /login (page de connexion) et /inscription (création d'une école)
     * - /super-admin/login (connexion séparée du propriétaire de la
     *   plateforme — le reste de /super-admin reste protégé normalement :
     *   il faut une session valide ET, en plus, passer requireSuperAdmin()
     *   côté serveur, qui rejette tout rôle autre que SUPER_ADMIN)
     * - /auth/callback (pont Supabase -> next-auth pour "Continuer avec
     *   Google" : le navigateur n'est pas encore authentifié côté next-auth
     *   à ce stade, donc cette page doit rester accessible sans session)
     * - /api/auth (routes NextAuth)
     * - manifest.webmanifest, sw.js, offline.html (PWA : le navigateur les
     *   récupère sans session ; rediriger vers /login casserait
     *   l'installation "Ajouter à l'écran d'accueil" et l'enregistrement du
     *   service worker, qui recevraient du HTML au lieu du JSON/JS attendu)
     * - les fichiers statiques et assets Next.js
     *
     * Le « + » final (au lieu de « * ») est ce qui laisse la racine publique :
     * il impose au moins un caractère après le slash.
     */
    "/((?!login|inscription|auth/callback|api/auth|super-admin/login|manifest\\.webmanifest|sw\\.js|offline\\.html|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)).+)",
  ],
};
