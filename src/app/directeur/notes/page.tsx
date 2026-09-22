import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { loadGradeSheet } from "@/lib/grade-sheet-data";
import { GradeSheetView } from "./grade-sheet-view";

/**
 * Saisie des notes du collège et du lycée : devoirs et composition, matière
 * par matière. Les classes du Fondamental y sont listées, mais renvoient à
 * la page Examens, où leur saisie et leur calcul restent ceux d'origine.
 */
export default async function GradesPage({
  searchParams,
}: {
  searchParams: Promise<{ classe?: string; matiere?: string; trimestre?: string }>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = await loadGradeSheet({ schoolId: user.schoolId, params: await searchParams });

  return (
    <GradeSheetView
      key={`${data.classId}:${data.subjectId}:${data.term}`}
      data={data}
      examsHref="/directeur/examens"
      settingsHref="/directeur/parametres#calcul"
    />
  );
}
