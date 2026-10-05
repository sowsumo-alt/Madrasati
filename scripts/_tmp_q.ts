import { prisma } from "../src/lib/prisma";
import { familyBalance } from "../src/lib/family";

/** Vérification en base des familles de test « ZZTEST » ; « clean » : tout supprimer. */
const schoolId = "cmtz1uwk60000ulqomx6rl6tk";

(async () => {
  const parents = await prisma.parent.findMany({
    where: { schoolId, lastName: { contains: "ZZTEST" } },
    include: {
      studentLinks: {
        include: {
          student: {
            include: { fees: { orderBy: { dueDate: "asc" }, include: { payments: true } }, tuitionPlans: true },
          },
        },
      },
      familyPayments: { include: { payments: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (process.argv[2] === "clean") {
    const ids = parents.flatMap((p) => p.studentLinks.map((l) => l.studentId));
    const fp = parents.flatMap((p) => p.familyPayments.map((f) => f.id));
    await prisma.payment.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.familyPayment.deleteMany({ where: { id: { in: fp } } });
    await prisma.fee.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.tuitionPlan.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.studentParent.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.student.deleteMany({ where: { id: { in: ids } } });
    console.log("supprimé :", await prisma.parent.deleteMany({ where: { id: { in: parents.map((p) => p.id) } } }));
    return prisma.$disconnect();
  }

  const now = new Date();
  for (const p of parents) {
    console.log(`\n== ${p.familyName} (${p.studentLinks.length} enfant(s))`);
    for (const l of p.studentLinks) {
      const fees = l.student.fees;
      const due = fees.reduce((s, f) => s + f.amount, 0);
      const paid = fees.reduce((s, f) => s + f.payments.reduce((x, y) => x + y.amount, 0), 0);
      console.log(
        `  ${l.student.firstName} : ${fees.length} ligne(s), dû ${due}, versé ${paid}, formule(s) ${l.student.tuitionPlans.length}, de la famille ${fees.filter((f) => f.familyParentId === p.id).length}`,
      );
      for (const f of fees.filter((f) => f.payments.length > 0 || f.dueDate <= now)) {
        const v = f.payments.reduce((x, y) => x + y.amount, 0);
        console.log(`     ${f.label.replace("Frais de scolarité — ", "")} : dû ${f.amount}, versé ${v}, ${f.status}, ${f.payments.length} paiement(s)`);
      }
    }
    const allFees = p.studentLinks.flatMap((l) => l.student.fees);
    const bal = familyBalance(
      allFees.map((f) => ({ amount: f.amount, totalPaid: f.payments.reduce((x, y) => x + y.amount, 0), dueDate: f.dueDate })),
      now,
    );
    const unpaidDue = allFees.filter((f) => f.dueDate <= now && f.amount > f.payments.reduce((x, y) => x + y.amount, 0));
    console.log(`  Reçus familiaux : ${p.familyPayments.map((fp) => `${fp.receiptNumber}=${fp.total} (somme des lignes ${fp.payments.reduce((s, x) => s + x.amount, 0)})`).join(", ")}`);
    console.log(`  Solde famille : total ${bal.billed}, versé ${bal.paid}, reste dû à ce jour ${bal.due}, à venir ${bal.upcoming} ; impayés échus : ${unpaidDue.map((f) => f.label).join(", ") || "aucun"}`);
  }
  await prisma.$disconnect();
})();
