import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";
(async () => {
  const u = await prisma.user.findUnique({ where: { email: "directeur@ecole-demo.mr" } });
  console.log(u?.isActive, u?.updatedAt, await bcrypt.compare("Madrasati2026!", u!.passwordHash));
  await prisma.$disconnect();
})();
