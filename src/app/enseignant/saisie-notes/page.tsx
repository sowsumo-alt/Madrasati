import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { getTeacherScope } from "@/lib/teacher-scope";
import { loadGradeSheet } from "@/lib/grade-sheet-data";
import { GradeSheetView } from "@/app/directeur/notes/grade-sheet-view";

/** La grille Devoirs / Composition de l'enseignant, limitée à ses classes. */
export default async function TeacherGradeSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ classe?: string; matiere?: string; trimestre?: string }>;
}) {
  const user = await requireRole(ROLES.TEACHER);
  const scope = await getTeacherScope(user.id, user.schoolId);
  const data = await loadGradeSheet({
    schoolId: user.schoolId,
    classIds: scope?.currentClassIds ?? [],
    teacherId: scope?.teacher.id ?? "",
    params: await searchParams,
  });

  return (
    <GradeSheetView
      key={`${data.classId}:${data.subjectId}:${data.term}`}
      data={data}
      examsHref="/enseignant/notes"
    />
  );
}
