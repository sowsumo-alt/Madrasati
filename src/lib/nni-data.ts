import { prisma } from "@/lib/prisma";
import { storedNni } from "@/lib/nni";

/**
 * Un NNI identifie une seule personne : deux élèves de la même école ne
 * peuvent pas le partager. Refuse l'enregistrement si l'un des NNI saisis
 * appartient déjà à un autre élève, ou apparaît deux fois dans la saisie
 * (deux enfants d'une même famille).
 */
export async function assertNnisAvailable(
  schoolId: string,
  nnis: (string | null | undefined)[],
  exceptStudentId?: string,
) {
  const filled = nnis.map(storedNni).filter((n): n is string => n != null);
  const repeated = filled.find((nni, i) => filled.indexOf(nni) !== i);
  if (repeated) throw new Error(`Le NNI ${repeated} est saisi pour deux enfants.`);
  if (filled.length === 0) return;

  const taken = await prisma.student.findFirst({
    where: {
      schoolId,
      nni: { in: filled },
      ...(exceptStudentId ? { id: { not: exceptStudentId } } : {}),
    },
    select: { firstName: true, lastName: true, nni: true },
  });
  if (taken) {
    throw new Error(
      `Le NNI ${taken.nni} est déjà celui de ${taken.firstName} ${taken.lastName}.`,
    );
  }
}

/** Même contrôle, mais le message est renvoyé : null si les NNI sont libres. */
export async function nniConflict(
  schoolId: string,
  nnis: (string | null | undefined)[],
  exceptStudentId?: string,
): Promise<string | null> {
  try {
    await assertNnisAvailable(schoolId, nnis, exceptStudentId);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "NNI déjà utilisé.";
  }
}
