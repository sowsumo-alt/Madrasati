import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ROLES } from "@/lib/roles";

export default async function Home() {
  const user = await getCurrentUser();

  // Visiteur non connecté : l'écran de connexion, qui porte lui-même la
  // présentation de Madrasati sur son volet de gauche.
  // Utilisateur connecté : on l'envoie directement dans son espace.
  if (!user) redirect("/login");

  // Le rôle est vérifié avant tout : un Super Admin a lui aussi un schoolId
  // vide (voir jwt() dans src/lib/auth.ts) mais ne doit jamais atterrir sur
  // le formulaire de création d'école — seule une identité Google réellement
  // "pending" (aucun rôle du tout, voir plus bas) doit y être envoyée.
  switch (user.role) {
    case ROLES.DIRECTOR:
      redirect("/directeur");
    case ROLES.TEACHER:
      redirect("/enseignant");
    case ROLES.PARENT:
      redirect("/parent");
    case "SUPER_ADMIN":
      redirect("/super-admin");
  }

  // Identité Google authentifiée mais sans école : direction le formulaire
  // de création avant tout accès à l'application.
  if (user.pending) redirect("/inscription/ecole");

  redirect("/login");
}
