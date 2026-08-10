import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { ComingSoon } from "@/components/layout/coming-soon";

export default async function TeacherHome() {
  await requireRole(ROLES.TEACHER);

  return (
    <ComingSoon
      title="Espace enseignant — bientôt disponible"
      description="L'appel, la saisie des notes et l'emploi du temps arrivent dans une prochaine étape."
    />
  );
}
