import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { ComingSoon } from "@/components/layout/coming-soon";

export default async function ParentHome() {
  await requireRole(ROLES.PARENT);

  return (
    <ComingSoon
      title="Espace parent — bientôt disponible"
      description="Le suivi des notes, présences et paiements de votre enfant arrive dans une prochaine étape."
    />
  );
}
