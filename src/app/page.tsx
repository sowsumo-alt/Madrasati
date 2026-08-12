import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { LandingPage } from "./(marketing)/landing-page";

export default async function Home() {
  const user = await getCurrentUser();

  // Visiteur non connecté : page de présentation.
  // Utilisateur connecté : on l'envoie directement dans son espace.
  if (!user) return <LandingPage />;

  // Identité Google authentifiée mais sans école : direction le formulaire
  // de création avant tout accès à l'application.
  if (!user.schoolId) redirect("/inscription/ecole");

  switch (user.role) {
    case ROLES.DIRECTOR:
      redirect("/directeur");
    case ROLES.TEACHER:
      redirect("/enseignant");
    case ROLES.PARENT:
      redirect("/parent");
    default:
      redirect("/login");
  }
}
