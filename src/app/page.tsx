import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ROLES } from "@/lib/roles";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

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
