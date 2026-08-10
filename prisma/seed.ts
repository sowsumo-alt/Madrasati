import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Matières du programme mauritanien, avec un coefficient par défaut.
const MAURITANIAN_SUBJECTS = [
  { name: "Mathématiques", coefficient: 4 },
  { name: "Français", coefficient: 3 },
  { name: "Arabe", coefficient: 3 },
  { name: "Études Islamiques", coefficient: 2 },
  { name: "Physique-Chimie", coefficient: 3 },
  { name: "Sciences de la Vie et de la Terre", coefficient: 2 },
  { name: "Histoire-Géographie", coefficient: 2 },
  { name: "Anglais", coefficient: 2 },
  { name: "Informatique", coefficient: 1 },
  { name: "Éducation Physique", coefficient: 1 },
];

// Jours fériés civils mauritaniens (dates fixes chaque année).
const CIVIL_HOLIDAYS_2026 = [
  { name: "Jour de l'An", date: "2026-01-01" },
  { name: "Fête du Travail", date: "2026-05-01" },
  { name: "Journée de l'Afrique", date: "2026-05-25" },
  { name: "Fête de l'Indépendance", date: "2026-11-28" },
];

// Fêtes religieuses : dates approximatives (calendrier lunaire, à confirmer
// localement chaque année selon l'observation de la lune).
const RELIGIOUS_HOLIDAYS_2026 = [
  { name: "Mawlid (Naissance du Prophète)", date: "2025-09-04" },
  { name: "Aïd al-Fitr", date: "2026-03-20" },
  { name: "Aïd al-Adha", date: "2026-05-27" },
];

const DEFAULT_TEMPLATES: Array<{
  key: string;
  title: string;
  body: string;
}> = [
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

const DEMO_PASSWORD = "Madrasati2026!";

/**
 * Crée les comptes de démonstration enseignant et parent, et les rattache à
 * des données existantes. Idempotent : peut être relancé sur une base déjà
 * remplie sans rien dupliquer.
 */
async function ensureDemoAccounts(schoolId: string) {
  // — Enseignant
  const teacherEmail = "enseignant@ecole-demo.mr";
  let teacherUser = await prisma.user.findUnique({ where: { email: teacherEmail } });
  if (!teacherUser) {
    teacherUser = await prisma.user.create({
      data: {
        schoolId,
        email: teacherEmail,
        passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
        role: "TEACHER",
        name: "Khadijetou Mint Ely",
        phone: "+22246778899",
      },
    });
  }

  let teacher = await prisma.teacher.findFirst({ where: { userId: teacherUser.id } });
  if (!teacher) {
    teacher = await prisma.teacher.create({
      data: {
        schoolId,
        userId: teacherUser.id,
        firstName: "Khadijetou",
        lastName: "Mint Ely",
        phone: "+22246778899",
        email: teacherEmail,
        subjectSpecialty: "Mathématiques",
        diploma: "Licence en Mathématiques",
        monthlySalary: 45000,
        hireDate: new Date("2024-09-01"),
        status: "ACTIVE",
      },
    });
  }

  // Elle est professeure principale de la 6ème A et y enseigne les maths.
  const mainClass = await prisma.classRoom.findFirst({
    where: { schoolId, name: "6ème A" },
  });
  const maths = await prisma.subject.findFirst({
    where: { schoolId, name: "Mathématiques" },
  });

  if (mainClass) {
    await prisma.classRoom.update({
      where: { id: mainClass.id },
      data: { mainTeacherId: teacher.id },
    });

    if (maths) {
      await prisma.classSubject.upsert({
        where: {
          classId_subjectId: { classId: mainClass.id, subjectId: maths.id },
        },
        create: { classId: mainClass.id, subjectId: maths.id, teacherId: teacher.id },
        update: { teacherId: teacher.id },
      });
    }
  }

  // — Parent : on rattache un compte au premier parent déjà créé.
  const parentRecord = await prisma.parent.findFirst({
    where: { schoolId },
    orderBy: { createdAt: "asc" },
  });
  if (parentRecord && !parentRecord.userId) {
    const parentEmail = "parent@ecole-demo.mr";
    let parentUser = await prisma.user.findUnique({ where: { email: parentEmail } });
    if (!parentUser) {
      parentUser = await prisma.user.create({
        data: {
          schoolId,
          email: parentEmail,
          passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
          role: "PARENT",
          name: `${parentRecord.firstName} ${parentRecord.lastName}`,
          phone: parentRecord.phone,
        },
      });
    }
    await prisma.parent.update({
      where: { id: parentRecord.id },
      data: { userId: parentUser.id },
    });
  }

  console.log("Comptes de démonstration :");
  console.log(`  Enseignant : ${teacherEmail} / ${DEMO_PASSWORD}`);
  console.log(`  Parent     : parent@ecole-demo.mr / ${DEMO_PASSWORD}`);
}

async function main() {
  const existing = await prisma.school.findFirst();
  if (existing) {
    console.log(`Une école existe déjà (${existing.name}) — création ignorée.`);
    await ensureDemoAccounts(existing.id);
    return;
  }

  const school = await prisma.school.create({
    data: {
      name: "École Démo Madrasati",
      address: "Tevragh-Zeina, Nouakchott, Mauritanie",
      phone: "+22245123456",
      email: "contact@ecole-demo.mr",
      currency: "MRU",
    },
  });

  const academicYear = await prisma.academicYear.create({
    data: {
      schoolId: school.id,
      label: "2025-2026",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-06-30"),
      isCurrent: true,
    },
  });

  await prisma.subject.createMany({
    data: MAURITANIAN_SUBJECTS.map((s) => ({ ...s, schoolId: school.id })),
  });

  const classes = await Promise.all(
    [
      { name: "CI A", level: "CI" },
      { name: "CM2 A", level: "CM2" },
      { name: "6ème A", level: "6ème" },
      { name: "Terminale A", level: "Terminale" },
    ].map((c) =>
      prisma.classRoom.create({
        data: {
          schoolId: school.id,
          academicYearId: academicYear.id,
          name: c.name,
          level: c.level,
          capacity: 35,
        },
      }),
    ),
  );

  await prisma.holiday.createMany({
    data: [
      ...CIVIL_HOLIDAYS_2026.map((h) => ({
        name: h.name,
        date: new Date(h.date),
        isReligious: false,
      })),
      ...RELIGIOUS_HOLIDAYS_2026.map((h) => ({
        name: h.name,
        date: new Date(h.date),
        isReligious: true,
      })),
    ],
  });

  await prisma.messageTemplate.createMany({
    data: DEFAULT_TEMPLATES.map((tpl) => ({ ...tpl, schoolId: school.id })),
  });

  const directorPassword = "Madrasati2026!";
  const directorUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "directeur@ecole-demo.mr",
      passwordHash: await bcrypt.hash(directorPassword, 10),
      role: "DIRECTOR",
      name: "Abou Directeur",
      phone: "+22245123456",
    },
  });

  const demoStudents = [
    {
      firstName: "Mohamed",
      lastName: "Ould Ahmed",
      gender: "M",
      classIdx: 2,
      parent: { firstName: "Ahmed", lastName: "Ould Sidi", phone: "+22242011122" },
    },
    {
      firstName: "Fatimetou",
      lastName: "Mint Salem",
      gender: "F",
      classIdx: 2,
      parent: { firstName: "Salem", lastName: "Ould Vall", phone: "+22242011133" },
    },
    {
      firstName: "Sidi",
      lastName: "Ould Bouna",
      gender: "M",
      classIdx: 1,
      parent: { firstName: "Bouna", lastName: "Ould Cheikh", phone: "+22242011144" },
    },
    {
      firstName: "Aichetou",
      lastName: "Mint Beyrouk",
      gender: "F",
      classIdx: 3,
      parent: { firstName: "Beyrouk", lastName: "Ould Hamady", phone: "+22242011155" },
    },
    {
      firstName: "Abdellahi",
      lastName: "Ould Moctar",
      gender: "M",
      classIdx: 0,
      parent: { firstName: "Moctar", lastName: "Ould Baba", phone: "+22242011166" },
    },
  ];

  for (const s of demoStudents) {
    const parent = await prisma.parent.create({
      data: {
        schoolId: school.id,
        firstName: s.parent.firstName,
        lastName: s.parent.lastName,
        phone: s.parent.phone,
        relationship: "père",
      },
    });

    const student = await prisma.student.create({
      data: {
        schoolId: school.id,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        classId: classes[s.classIdx].id,
        status: "ACTIVE",
      },
    });

    await prisma.studentParent.create({
      data: { studentId: student.id, parentId: parent.id, isPrimary: true },
    });

    const fee = await prisma.fee.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        academicYearId: academicYear.id,
        label: "Frais de scolarité — Trimestre 1",
        amount: 15000,
        dueDate: new Date("2025-10-15"),
        status: "PENDING",
      },
    });

    // Deux élèves sur cinq ont déjà payé, pour peupler le tableau de bord.
    const paidIndex = demoStudents.indexOf(s);
    if (paidIndex === 0 || paidIndex === 3) {
      await prisma.payment.create({
        data: {
          schoolId: school.id,
          feeId: fee.id,
          studentId: student.id,
          amount: 15000,
          method: "CASH",
          receiptNumber: `REC-2026-${String(paidIndex + 1).padStart(4, "0")}`,
        },
      });
      await prisma.fee.update({
        where: { id: fee.id },
        data: { status: "PAID" },
      });
    }
  }

  await ensureDemoAccounts(school.id);

  console.log("Seed terminé.");
  console.log("École :", school.name);
  console.log("Connexion directeur :");
  console.log("  Email    :", directorUser.email);
  console.log("  Mot de passe :", directorPassword);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
