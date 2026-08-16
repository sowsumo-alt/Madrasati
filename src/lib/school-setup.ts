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

/**
 * Modèles livrés avec chaque école, dans les deux langues. Le jeton
 * {schoolName} est toujours résolu par le code appelant vers « École X » (ou
 * « مدرسة X » côté arabe) — le texte du modèle ne doit donc jamais écrire
 * « École » ou « مدرسة » lui-même, sous peine de doublon (« École École X »).
 */
export const DEFAULT_TEMPLATES = [
  {
    key: "ABSENCE_ALERT",
    title: "Alerte d'absence",
    body:
      "Bonjour {parentName},\n\nNous vous informons que {studentName} est absent(e) aujourd'hui ({date}). Merci de nous contacter si besoin.\n\n{schoolName}",
    bodyAr:
      "مرحبًا {parentName}،\n\nنعلمكم بأن {studentName} غائب(ة) اليوم الموافق {date}. يرجى الاتصال بنا عند الحاجة.\n\n{schoolName}",
  },
  {
    key: "LATE_ARRIVAL",
    title: "Retard de l'élève",
    body:
      "Bonjour {parentName},\n\nNous vous informons que {studentName} est arrivé(e) en retard aujourd'hui ({date}). Merci de veiller à la ponctualité.\n\n{schoolName}",
    bodyAr:
      "مرحبًا {parentName}،\n\nنعلمكم بأن {studentName} وصل(ت) متأخرًا اليوم الموافق {date}. يرجى الحرص على الالتزام بالوقت.\n\n{schoolName}",
  },
  {
    key: "PAYMENT_REMINDER",
    title: "Rappel de paiement",
    body:
      "Bonjour {parentName},\n\nNous vous rappelons que des frais de scolarité de {amount} MRU concernant {studentName} sont en attente de paiement, avec échéance au {date}. Merci de bien vouloir régulariser votre situation.\n\n{schoolName}",
    bodyAr:
      "مرحبًا {parentName}،\n\nنذكركم بأن مبلغ {amount} أوقية موريتانية الخاص بالرسوم الدراسية لـ {studentName} لا يزال معلقًا، وتاريخ الاستحقاق هو {date}. يرجى التكرم بتسوية وضعيتكم.\n\n{schoolName}",
  },
  {
    key: "PAYMENT_CONFIRMATION",
    title: "Confirmation de paiement",
    body:
      "Bonjour {parentName},\n\nNous confirmons la réception d'un paiement de {amount} MRU pour {studentName}, effectué le {date}. Merci pour votre règlement.\n\n{schoolName}",
    bodyAr:
      "مرحبًا {parentName}،\n\nنؤكد استلام دفعة بمبلغ {amount} أوقية موريتانية لـ {studentName}، بتاريخ {date}. شكرًا لتسديدكم.\n\n{schoolName}",
  },
  {
    key: "GRADES_AVAILABLE",
    title: "Notes disponibles",
    body:
      "Bonjour {parentName},\n\nLes notes de {studentName} sont désormais disponibles (moyenne générale : {average}/20). N'hésitez pas à nous contacter pour en discuter.\n\n{schoolName}",
    bodyAr:
      "مرحبًا {parentName}،\n\nأصبح كشف نقاط {studentName} متوفرًا الآن (المعدل العام: {average}/20). لا تترددوا في الاتصال بنا لمناقشته.\n\n{schoolName}",
  },
  {
    key: "DOCUMENT_PICKUP",
    title: "Bulletin à récupérer",
    body:
      "Bonjour {parentName},\n\nLe bulletin de {studentName} est prêt et peut être retiré à l'école dès que possible.\n\n{schoolName}",
    bodyAr:
      "مرحبًا {parentName}،\n\nكشف نقاط {studentName} جاهز، ويمكنكم استلامه من المدرسة في أقرب وقت ممكن.\n\n{schoolName}",
  },
  {
    key: "MEETING_INVITE",
    title: "Invitation réunion",
    body:
      "Bonjour {parentName},\n\nVous êtes invité(e) à une réunion concernant {studentName} le {date} à [heure]. Votre présence est importante.\n\n{schoolName}",
    bodyAr:
      "مرحبًا {parentName}،\n\nأنتم مدعوون لحضور اجتماع بخصوص {studentName} يوم {date} الساعة [التوقيت]. حضوركم مهم.\n\n{schoolName}",
  },
  {
    key: "GENERAL_ANNOUNCEMENT",
    title: "Annonce générale",
    body:
      "Bonjour {parentName},\n\n[Votre annonce ici — événement, jour férié, changement d'horaire, etc.]\n\n{schoolName}",
    bodyAr:
      "مرحبًا {parentName}،\n\n[أدخلوا إعلانكم هنا — مناسبة، عطلة، تغيير في التوقيت، إلخ.]\n\n{schoolName}",
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
