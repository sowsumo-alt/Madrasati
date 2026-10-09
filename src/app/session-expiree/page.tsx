import { SessionExpired } from "./session-expired";

/**
 * Session antérieure à une déconnexion ou à un changement de mot de passe :
 * le cookie est encore lisible mais n'est plus accepté. La page ferme la
 * session dans le navigateur et renvoie vers la bonne page de connexion.
 */
export default async function SessionExpiredPage({ searchParams }: { searchParams: Promise<{ espace?: string }> }) {
  const { espace } = await searchParams;
  return <SessionExpired loginUrl={espace === "super-admin" ? "/super-admin/login" : "/login"} />;
}
