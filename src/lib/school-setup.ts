import { prisma } from "@/lib/prisma";

/**
 * Contenu livré avec chaque nouvelle école : le programme mauritanien et les
 * modèles de messages WhatsApp. Une école inscrite en ligne est ainsi
 * utilisable dès la première connexion, sans paramétrage.
 *
 * Ces listes existent aussi dans prisma/seed.ts, qui fabrique l'école de
 * démonstration : le script de seed tourne hors de l'application (tsx) et
 * garde donc sa propre copie.
 */
export const MAURITANIAN_SUBJECTS = [
  { name: "Mathématiques", nameAr: "الرياضيات", coefficient: 4 },
  { name: "Français", nameAr: "اللغة الفرنسية", coefficient: 3 },
  { name: "Arabe", nameAr: "اللغة العربية", coefficient: 3 },
  { name: "Études Islamiques", nameAr: "التربية الإسلامية", coefficient: 2 },
  { name: "Physique-Chimie", nameAr: "الفيزياء والكيمياء", coefficient: 3 },
  {
    name: "Sciences de la Vie et de la Terre",
    nameAr: "علوم الحياة والأرض",
    coefficient: 2,
  },
  { name: "Histoire-Géographie", nameAr: "التاريخ والجغرافيا", coefficient: 2 },
  { name: "Anglais", nameAr: "اللغة الإنجليزية", coefficient: 2 },
  { name: "Informatique", nameAr: "المعلوماتية", coefficient: 1 },
  { name: "Éducation Physique", nameAr: "التربية البدنية", coefficient: 1 },
];

export const DEFAULT_TEMPLATES = [
  {
    key: "PAYMENT_REMINDER",
    title: "Rappel de paiement",
    body:
      "Bonjour {parentName}, nous vous rappelons que les frais de scolarité de {studentName} ({amount} MRU) sont en attente de paiement. Merci de régulariser dès que possible. École {schoolName}.",
  },
  {
    key: "ABSENCE_ALERT",
    title: "Alerte d'absence",
    body:
      "Bonjour {parentName}, nous vous informons que {studentName} est absent(e) aujourd'hui ({date}). Merci de nous contacter si besoin. École {schoolName}.",
  },
  {
    key: "GRADES_AVAILABLE",
    title: "Notes disponibles",
    body:
      "Bonjour {parentName}, les notes de {studentName} sont désormais disponibles. N'hésitez pas à nous contacter pour en discuter. École {schoolName}.",
  },
  {
    key: "MEETING_INVITE",
    title: "Invitation réunion",
    body:
      "Bonjour {parentName}, vous êtes invité(e) à une réunion concernant {studentName} le {date}. Votre présence est importante. École {schoolName}.",
  },
];

/**
 * Année scolaire en cours : elle commence en septembre. Une inscription faite
 * en mars 2026 rejoint donc l'année « 2025-2026 », pas « 2026-2027 ».
 */
export function currentAcademicYear(today = new Date()) {
  const startYear =
    today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
  return {
    label: `${startYear}-${startYear + 1}`,
    startDate: new Date(startYear, 8, 1),
    endDate: new Date(startYear + 1, 5, 30),
  };
}

/**
 * Crée une école complète et son compte directeur, en une seule transaction :
 * si une étape échoue, aucune école à moitié créée ne reste en base.
 */
export async function createSchoolWithDirector(input: {
  schoolName: string;
  directorName: string;
  email: string;
  phone: string;
  city?: string;
  passwordHash: string;
}) {
  const year = currentAcademicYear();

  return prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: {
        name: input.schoolName,
        phone: input.phone,
        email: input.email,
        city: input.city,
        currency: "MRU",
      },
    });

    await tx.academicYear.create({
      data: {
        schoolId: school.id,
        label: year.label,
        startDate: year.startDate,
        endDate: year.endDate,
        isCurrent: true,
      },
    });

    await tx.subject.createMany({
      data: MAURITANIAN_SUBJECTS.map((s) => ({ ...s, schoolId: school.id })),
    });

    await tx.messageTemplate.createMany({
      data: DEFAULT_TEMPLATES.map((t) => ({ ...t, schoolId: school.id })),
    });

    return tx.user.create({
      data: {
        schoolId: school.id,
        email: input.email,
        passwordHash: input.passwordHash,
        role: "DIRECTOR",
        name: input.directorName,
        phone: input.phone,
      },
      select: { id: true, email: true },
    });
  });
}
