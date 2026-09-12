import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ROLES } from "@/lib/roles";

export default async function Home() {
  const user = await getCurrentUser();

  // Visiteur non connecté : l'écran de connexion, qui porte lui-même la
  // présentation de Madrasati sur son volet de gauche.
  // Utilisateur connecté : on l'envoie directement dans son espace.
  if (!user) redirect("/login");

  // Chaque rôle rejoint son espace. Un Super Admin a un schoolId vide (voir
  // jwt() dans src/lib/auth.ts) : c'est son rôle, et lui seul, qui l'oriente.
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

  // Rôle inconnu : on ne devine pas, on renvoie à la connexion.
  redirect("/login");
}
