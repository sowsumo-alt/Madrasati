import Link from "next/link";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMRU, formatDate } from "@/lib/format";
import { Users, Wallet, AlertCircle, School as SchoolIcon, UserPlus } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  TRANSFERRED: "Transféré",
  GRADUATED: "Diplômé",
};

export default async function DashboardPage() {
  const user = await requireRole(ROLES.DIRECTOR);
  const schoolId = user.schoolId;

  const [studentCount, classCount, payments, unpaidFees, recentStudents] =
    await Promise.all([
      prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
      prisma.classRoom.count({ where: { schoolId } }),
      prisma.payment.aggregate({
        where: { schoolId },
        _sum: { amount: true },
      }),
      prisma.fee.aggregate({
        where: { schoolId, status: { not: "PAID" } },
        _sum: { amount: true },
      }),
      prisma.student.findMany({
        where: { schoolId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { classRoom: { select: { name: true } } },
      }),
    ]);

  const collected = payments._sum.amount ?? 0;
  const outstanding = unpaidFees._sum.amount ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Tableau de bord
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          Voici l&apos;essentiel de votre école aujourd&apos;hui.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Élèves inscrits"
          value={String(studentCount)}
          icon={Users}
          tone="primary"
        />
        <StatTile
          label="Classes"
          value={String(classCount)}
          icon={SchoolIcon}
          tone="neutral"
        />
        <StatTile
          label="Encaissé"
          value={formatMRU(collected)}
          icon={Wallet}
          tone="accent"
        />
        <StatTile
          label="Impayé"
          value={formatMRU(outstanding)}
          icon={AlertCircle}
          tone="warning"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Élèves ajoutés récemment</CardTitle>
          <Link href="/directeur/eleves">
            <Button variant="secondary" size="sm">
              Voir tous les élèves
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
              <p className="text-sm text-foreground/60">
                Aucun élève pour l&apos;instant.
              </p>
              <Link href="/directeur/eleves">
                <Button size="sm">
                  <UserPlus className="h-4 w-4" />
                  Ajouter votre premier élève
                </Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentStudents.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {s.firstName} {s.lastName}
                    </p>
                    <p className="text-xs text-foreground/50">
                      {s.classRoom?.name ?? "Sans classe"} · Ajouté le{" "}
                      {formatDate(s.createdAt)}
                    </p>
                  </div>
                  <Badge variant={s.status === "ACTIVE" ? "success" : "neutral"}>
                    {STATUS_LABELS[s.status] ?? s.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
