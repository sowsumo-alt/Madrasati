import { prisma } from "../src/lib/prisma";

/**
 * État en base des familles de test « ZZTEST » (étape 2) ; « clean » : tout
 * supprimer ; « orphans » : vérifier qu'aucune ligne ne reste sans élève.
 */
const schoolId = "cmtz1uwk60000ulqomx6rl6tk";

(async () => {
  const mode = process.argv[2];
  if (mode === "orphans") {
    const rows = await prisma.$queryRaw<{ what: string; n: bigint }[]>`
      SELECT 'fees sans élève' AS what, COUNT(*) AS n FROM fees f WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.id = f."studentId")
      UNION ALL SELECT 'paiements sans frais', COUNT(*) FROM payments p WHERE NOT EXISTS (SELECT 1 FROM fees f WHERE f.id = p."feeId")
      UNION ALL SELECT 'reçus familiaux vides', COUNT(*) FROM family_payments fp WHERE fp."cancelledAt" IS NULL AND NOT EXISTS (SELECT 1 FROM payments p WHERE p."familyPaymentId" = fp.id)
      UNION ALL SELECT 'élèves ZZTEST', COUNT(*) FROM students WHERE "lastName" = 'ZZTEST'
      UNION ALL SELECT 'parents ZZTEST', COUNT(*) FROM parents WHERE "lastName" LIKE '%ZZTEST%'
      UNION ALL SELECT 'annulations ZZTEST', COUNT(*) FROM cancelled_payments WHERE "studentName" LIKE '%ZZTEST%'`;
    for (const r of rows) console.log(`${r.what} : ${r.n}`);
    return prisma.$disconnect();
  }
  const parents = await prisma.parent.findMany({
    where: { schoolId, lastName: { contains: "ZZTEST" } },
    include: {
      familyPayments: { include: { payments: true, cancelledParts: true } },
      studentLinks: {
        include: { student: { include: { fees: { include: { payments: true } }, cancelledPayments: true } } },
      },
    },
  });
  if (mode === "clean") {
    const ids = parents.flatMap((p) => p.studentLinks.map((l) => l.studentId));
    const fp = parents.flatMap((p) => p.familyPayments.map((f) => f.id));
    await prisma.cancelledPayment.deleteMany({ where: { OR: [{ studentId: { in: ids } }, { familyPaymentId: { in: fp } }] } });
    await prisma.payment.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.familyPayment.deleteMany({ where: { id: { in: fp } } });
    await prisma.student.deleteMany({ where: { id: { in: ids } } });
    console.log("supprimé :", await prisma.parent.deleteMany({ where: { id: { in: parents.map((p) => p.id) } } }));
    return prisma.$disconnect();
  }
  const collected = await prisma.payment.aggregate({ where: { schoolId }, _sum: { amount: true } });
  console.log("Argent perçu de l'école (somme des paiements) :", collected._sum.amount);
  for (const p of parents) {
    console.log(`\n== ${p.familyName}`);
    for (const l of p.studentLinks) {
      const s = l.student;
      const paid = s.fees.reduce((x, f) => x + f.payments.reduce((y, z) => y + z.amount, 0), 0);
      const statuses = s.fees.filter((f) => f.payments.length || f.label.includes("inscription") || f.label.includes("Octobre") || f.label.includes("Juin")).map((f) => `${f.label.replace("Frais de scolarité — ", "")}=${f.amount}:${f.status}`);
      console.log(`  ${s.firstName} [${s.status}] : ${s.fees.length} ligne(s) (famille ${s.fees.filter((f) => f.familyParentId === p.id).length}), versé ${paid}, annulés ${s.cancelledPayments.length} | ${statuses.join(", ")}`);
    }
    for (const fp of p.familyPayments) {
      console.log(`  Reçu ${fp.receiptNumber} total ${fp.total} ${fp.cancelledAt ? `ANNULÉ (« ${fp.cancelReason} »), ${fp.cancelledParts.length} part(s) gardées` : `${fp.payments.length} part(s)`}`);
    }
  }
  await prisma.$disconnect();
})();
