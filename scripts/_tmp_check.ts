import { prisma } from "../src/lib/prisma";

const schoolId = "cmtz1uwk60000ulqomx6rl6tk";

(async () => {
  const students = await prisma.student.findMany({
    where: { schoolId, lastName: "ZZTESTPAYE" },
    include: {
      fees: { orderBy: { dueDate: "asc" }, include: { payments: true } },
    },
  });
  if (process.argv[2] === "clean") {
    const ids = students.map((s) => s.id);
    await prisma.payment.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.fee.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.tuitionPlan.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.studentParent.deleteMany({ where: { studentId: { in: ids } } });
    console.log(await prisma.student.deleteMany({ where: { id: { in: ids } } }));
    return prisma.$disconnect();
  }
  for (const s of students) {
    console.log(`\n${s.firstName} (inscrit le ${s.enrollmentDate.toISOString().slice(0, 10)})`);
    for (const f of s.fees) {
      const paid = f.payments.reduce((sum, p) => sum + p.amount, 0);
      console.log(
        `  ${f.label.padEnd(62)} ${String(f.amount).padStart(6)}  payé ${String(paid).padStart(6)}  ${f.status}` +
          (f.payments.length ? `  [${f.payments.map((p) => `${p.receiptNumber} ${p.method}`).join(", ")}]` : ""),
      );
    }
  }
  await prisma.$disconnect();
})();
