import Link from "next/link";
import {
  BookOpen,
  CalendarCheck,
  CircleCheck,
  Contact,
  HandCoins,
  Hourglass,
  Users,
  UserSearch,
  Wallet,
} from "lucide-react";
import { requireRole } from "@/lib/session";
import { ROLES, ROLE_LABELS } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { formatDateIn, formatLongDate, formatMRU } from "@/lib/format";
import { getTranslations } from "@/lib/i18n/server";
import {
  FEATURES,
  schoolHasFeature,
  trialEndsAt,
  daysBetween,
  TRIAL_REMINDER_DAYS,
} from "@/lib/plans";
import { findAtRiskStudents } from "@/lib/at-risk";
import { CURRENT_YEAR } from "@/lib/school-year";
import { outstandingTotal } from "@/lib/finance";
import {
  isPresent,
  isoDay,
  lastMonthKeys,
  minutesToTime,
  monthlyAttendance,
  monthlySums,
  percentChange,
  runningTotals,
  scheduleDay,
  startOfWeek,
  weeklyAttendance,
  type MonthKey,
} from "@/lib/dashboard-data";
import { HeroBanner } from "@/components/dashboard/hero-banner";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { AttendanceTrendCard } from "@/components/dashboard/attendance-trend-card";
import {
  RecentActivityCard,
  type ActivityEntry,
} from "@/components/dashboard/recent-activity-card";
import {
  UpcomingActivitiesCard,
  type UpcomingActivity,
} from "@/components/dashboard/upcoming-activities-card";
import { ClassDistributionCard } from "@/components/dashboard/class-distribution-card";
import { SchoolCard } from "@/components/dashboard/school-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { HelpCard } from "@/components/dashboard/help-card";
import { SchoolCalendar, type CalendarEvent } from "@/components/dashboard/school-calendar";
import {
  AnnouncementsCard,
  type Announcement,
} from "@/components/dashboard/announcements-card";
import { YearEndedBanner } from "./year-ended-banner";

const DAY_MS = 86_400_000;

/** « lun. » devient « Lun », « sept. » devient « Sept » : libellés d'axe courts. */
function shortLabel(value: string) {
  const trimmed = value.replace(/\.$/, "");
  return trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1);
}

const monthStart = (key: MonthKey) => new Date(Date.UTC(key.year, key.month, 1));

export default async function DashboardPage() {
  const user = await requireRole(ROLES.DIRECTOR);
  const schoolId = user.schoolId;
  const { t, locale } = await getTranslations();

  // Bornes en UTC, l'heure des écoles (voir src/lib/dashboard-data.ts).
  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const endOfToday = new Date(startOfToday.getTime() + DAY_MS);
  const inSevenDays = new Date(startOfToday.getTime() + 7 * DAY_MS);
  const inFourteenDays = new Date(startOfToday.getTime() + 14 * DAY_MS);
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const trendMonths = lastMonthKeys(now, 6);
  const attendanceMonths = lastMonthKeys(now, 9);
  // Le calendrier s'ouvre sur le mois en cours ; ses repères couvrent deux
  // mois en arrière et quatre en avant.
  const calendarFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  const calendarTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 5, 1));
  const todayDow = scheduleDay(now);
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  function attendanceQuality(rate: number, hasData: boolean) {
    if (!hasData) return t("dashboard.noRollCall");
    if (rate >= 90) return t("dashboard.veryGood");
    if (rate >= 75) return t("dashboard.correct");
    return t("dashboard.toWatch");
  }

  const [
    studentCount,
    newStudents,
    teacherCount,
    newTeachers,
    parentCount,
    todayAttendance,
    trendPayments,
    unpaidFees,
    paymentsByFee,
    upcomingExamCount,
    classes,
    attendanceHistory,
    activeStudents,
    activeTeachers,
    recentStudents,
    recentPayments,
    recentExams,
    recentAttendance,
    todaySlots,
    nextExams,
    calendarExams,
    holidays,
    school,
    currentYear,
  ] = await Promise.all([
    prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
    // Même filtre ACTIVE que le compteur principal : sans lui, la mention
    // « +17 ce mois » s'affichait sous une tuile annonçant 15 élèves, parce
    // que les élèves désinscrits restaient comptés dans les arrivées.
    prisma.student.count({
      where: { schoolId, status: "ACTIVE", createdAt: { gte: startOfMonth } },
    }),
    prisma.teacher.count({ where: { schoolId, status: "ACTIVE" } }),
    prisma.teacher.count({
      where: { schoolId, status: "ACTIVE", createdAt: { gte: startOfMonth } },
    }),
    prisma.parent.count({ where: { schoolId } }),
    prisma.attendanceRecord.findMany({
      where: { schoolId, date: { gte: startOfToday, lt: endOfToday } },
      select: { status: true },
    }),
    prisma.payment.findMany({
      where: { schoolId, paidAt: { gte: monthStart(trendMonths[0]) } },
      select: { amount: true, paidAt: true },
    }),
    // Le reste dû, pas le montant facturé : un frais de 15 000 MRU déjà réglé
    // à hauteur de 10 000 pesait pour 15 000 dans cette tuile, alors que la
    // page Finance et les relances WhatsApp, elles, annonçaient 5 000.
    prisma.fee.findMany({
      where: { schoolId, status: { not: "PAID" } },
      select: { id: true, amount: true },
    }),
    prisma.payment.groupBy({
      by: ["feeId"],
      where: { schoolId },
      _sum: { amount: true },
    }),
    prisma.exam.count({
      where: { schoolId, ...CURRENT_YEAR, date: { gte: startOfToday, lt: inSevenDays } },
    }),
    prisma.classRoom.findMany({
      where: { schoolId, ...CURRENT_YEAR },
      orderBy: { name: "asc" },
      select: {
        name: true,
        level: true,
        // Même règle de comptage que la tuile « Élèves inscrits » : sans le
        // filtre ACTIVE, la répartition et le nombre de classes actives
        // comptaient aussi les élèves inactifs ou transférés, et annonçaient
        // un total différent de celui des Statistiques.
        _count: { select: { students: { where: { status: "ACTIVE" } } } },
      },
    }),
    prisma.attendanceRecord.findMany({
      where: { schoolId, date: { gte: monthStart(attendanceMonths[0]) } },
      select: { date: true, status: true },
    }),
    prisma.student.findMany({
      where: { schoolId, status: "ACTIVE" },
      select: { createdAt: true },
    }),
    prisma.teacher.findMany({
      where: { schoolId, status: "ACTIVE" },
      select: { createdAt: true },
    }),
    prisma.student.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        firstName: true,
        lastName: true,
        createdAt: true,
        classRoom: { select: { name: true } },
      },
    }),
    prisma.payment.findMany({
      where: { schoolId },
      orderBy: { paidAt: "desc" },
      take: 3,
      select: {
        amount: true,
        paidAt: true,
        student: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.exam.findMany({
      where: { schoolId, ...CURRENT_YEAR },
      orderBy: { createdAt: "desc" },
      take: 2,
      select: {
        title: true,
        createdAt: true,
        subject: { select: { name: true } },
        classRoom: { select: { name: true } },
      },
    }),
    prisma.attendanceRecord.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        status: true,
        date: true,
        createdAt: true,
        classRoom: { select: { name: true } },
      },
    }),
    // Cours restants de la journée (pas de créneau le week-end).
    todayDow
      ? prisma.scheduleSlot.findMany({
          where: {
            dayOfWeek: todayDow,
            endMinutes: { gt: nowMinutes },
            classRoom: { schoolId, ...CURRENT_YEAR },
          },
          orderBy: { startMinutes: "asc" },
          take: 6,
          select: {
            id: true,
            startMinutes: true,
            endMinutes: true,
            room: true,
            classRoom: { select: { name: true } },
            classSubject: {
              select: {
                subject: { select: { name: true } },
                teacher: { select: { firstName: true, lastName: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.exam.findMany({
      where: { schoolId, ...CURRENT_YEAR, date: { gte: startOfToday, lt: inFourteenDays } },
      orderBy: { date: "asc" },
      take: 6,
      select: {
        id: true,
        title: true,
        date: true,
        subjectId: true,
        subject: { select: { name: true } },
        classRoom: {
          select: {
            name: true,
            classSubjects: {
              select: {
                subjectId: true,
                teacher: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    }),
    prisma.exam.findMany({
      where: { schoolId, date: { gte: calendarFrom, lt: calendarTo } },
      orderBy: { date: "asc" },
      select: { title: true, date: true },
    }),
    // Jours fériés propres à l'école et jours fériés nationaux (sans école).
    prisma.holiday.findMany({
      where: {
        OR: [{ schoolId }, { schoolId: null }],
        date: { gte: calendarFrom, lt: calendarTo },
      },
      orderBy: { date: "asc" },
      select: { id: true, name: true, date: true },
    }),
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        plan: true,
        subscriptionStatus: true,
        createdAt: true,
        nextDueAt: true,
      },
    }),
    // Année scolaire échue : tant qu'elle n'est pas remplacée, présences,
    // notes et frais continuent de s'enregistrer sur une année révolue.
    prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
      select: { label: true, endDate: true },
    }),
  ]);

  // Reste réellement dû, paiements partiels déduits (voir lib/finance.ts).
  const paidByFee = new Map(paymentsByFee.map((p) => [p.feeId, p._sum.amount ?? 0]));
  const outstanding = outstandingTotal(unpaidFees, paidByFee);

  const atRiskEnabled = schoolHasFeature(school, FEATURES.AT_RISK_DETECTION);
  const atRiskCount = atRiskEnabled ? (await findAtRiskStudents(schoolId)).length : 0;

  const yearEnded = currentYear ? currentYear.endDate < now : false;

  // Relance de fin d'essai : l'application n'envoie pas de message toute
  // seule, c'est donc ici que le directeur est prévenu, à chaque visite de son
  // tableau de bord, dès qu'il entre dans les derniers jours.
  const trialDaysLeft =
    school?.subscriptionStatus === "trial"
      ? daysBetween(new Date(), trialEndsAt(school))
      : null;
  const showTrialWarning =
    trialDaysLeft != null && trialDaysLeft <= TRIAL_REMINDER_DAYS;

  // — Tuiles
  const presentToday = todayAttendance.filter((a) => isPresent(a.status)).length;
  const attendanceRate =
    todayAttendance.length === 0
      ? 0
      : Math.round((presentToday / todayAttendance.length) * 100);

  const studentTrend = runningTotals(activeStudents.map((s) => s.createdAt), trendMonths);
  const teacherTrend = runningTotals(activeTeachers.map((s) => s.createdAt), trendMonths);
  const moneyByMonth = monthlySums(
    trendPayments.map((p) => ({ at: p.paidAt, amount: p.amount })),
    trendMonths,
  );
  const collectedThisMonth = moneyByMonth[moneyByMonth.length - 1] ?? 0;
  const moneyChange = percentChange(
    collectedThisMonth,
    moneyByMonth[moneyByMonth.length - 2] ?? 0,
  );

  // — Évolution de la présence : semaine en cours et derniers mois.
  const intlLocale = locale === "ar" ? "ar-u-nu-latn" : locale;
  const weekdayFormatter = new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: "UTC" });
  const monthFormatter = new Intl.DateTimeFormat(intlLocale, { month: "short", timeZone: "UTC" });
  const weekStart = startOfWeek(now);
  const weekPoints = weeklyAttendance(attendanceHistory, weekStart).map(({ dayIndex, rate }) => ({
    label: shortLabel(weekdayFormatter.format(new Date(weekStart.getTime() + dayIndex * DAY_MS))),
    value: rate,
  }));
  const monthPoints = monthlyAttendance(attendanceHistory, attendanceMonths).map(
    ({ month, rate }) => ({ label: shortLabel(monthFormatter.format(monthStart(month))), value: rate }),
  );

  // — Répartition des élèves, par classe et par niveau
  const byClass = classes.map((c) => ({ label: c.name, value: c._count.students }));
  const levelTotals = new Map<string, number>();
  for (const c of classes) {
    levelTotals.set(c.level, (levelTotals.get(c.level) ?? 0) + c._count.students);
  }
  const byLevel = [...levelTotals.entries()].map(([label, value]) => ({ label, value }));
  const activeClasses = classes.filter((c) => c._count.students > 0).length;

  // — Prochaines activités : cours restants du jour, puis examens à venir.
  const upcoming: UpcomingActivity[] = [
    ...todaySlots.map((s) => ({
      id: s.id,
      kind: "lesson" as const,
      when: `${minutesToTime(s.startMinutes)} – ${minutesToTime(s.endMinutes)}`,
      subject: s.classSubject.subject.name,
      title: s.room
        ? `${t("dashboard.lesson")} · ${t("dashboard.room")} ${s.room}`
        : t("dashboard.lesson"),
      className: s.classRoom.name,
      teacher: s.classSubject.teacher
        ? `${s.classSubject.teacher.firstName} ${s.classSubject.teacher.lastName}`
        : null,
    })),
    ...nextExams.map((e) => {
      const teacher = e.classRoom.classSubjects.find((cs) => cs.subjectId === e.subjectId)?.teacher;
      return {
        id: e.id,
        kind: "exam" as const,
        when: shortLabel(
          formatDateIn(locale, e.date, { weekday: "short", day: "numeric", month: "short" }),
        ),
        subject: e.subject.name,
        title: e.title,
        className: e.classRoom.name,
        teacher: teacher ? `${teacher.firstName} ${teacher.lastName}` : null,
      };
    }),
  ].slice(0, 6);

  // — Activité récente : élèves, paiements, appels et examens, fusionnés.
  const attendanceBatches = new Map<
    string,
    { className: string; present: number; total: number; at: Date }
  >();
  for (const record of recentAttendance) {
    const key = `${record.classRoom.name}-${isoDay(record.date)}`;
    const entry =
      attendanceBatches.get(key) ??
      { className: record.classRoom.name, present: 0, total: 0, at: record.createdAt };
    entry.total += 1;
    if (isPresent(record.status)) entry.present += 1;
    if (record.createdAt > entry.at) entry.at = record.createdAt;
    attendanceBatches.set(key, entry);
  }

  const activity: ActivityEntry[] = [
    ...recentStudents.map((s) => ({
      at: s.createdAt,
      kind: "student" as const,
      title: t("activity.newStudent"),
      detail: `${s.firstName} ${s.lastName}${s.classRoom ? ` — ${s.classRoom.name}` : ""}`,
    })),
    ...recentPayments.map((p) => ({
      at: p.paidAt,
      kind: "payment" as const,
      title: t("activity.paymentReceived"),
      detail: `${formatMRU(p.amount)} — ${p.student.firstName} ${p.student.lastName}`,
    })),
    ...[...attendanceBatches.values()].slice(0, 3).map((b) => ({
      at: b.at,
      kind: "attendance" as const,
      title: t("activity.attendanceRecorded"),
      detail: `${b.className} — ${Math.round((b.present / b.total) * 100)}%`,
    })),
    ...recentExams.map((e) => ({
      at: e.createdAt,
      kind: "exam" as const,
      title: t("activity.examCreated"),
      detail: `${e.subject.name} — ${e.title} (${e.classRoom.name})`,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 5);

  // — Calendrier : un seul repère par jour pour un même examen passé par
  // plusieurs classes.
  const calendarEvents: CalendarEvent[] = [];
  const seenEvents = new Set<string>();
  const addEvent = (event: CalendarEvent) => {
    const key = `${event.day}|${event.kind}|${event.label}`;
    if (seenEvents.has(key)) return;
    seenEvents.add(key);
    calendarEvents.push(event);
  };
  for (const e of calendarExams) addEvent({ day: isoDay(e.date), kind: "exam", label: e.title });
  for (const h of holidays) addEvent({ day: isoDay(h.date), kind: "holiday", label: h.name });

  // — Annonces : premier jour de chaque session d'examens à venir, et jours fériés.
  const examSessions = new Map<string, Date>();
  for (const e of calendarExams) {
    if (e.date >= startOfToday && !examSessions.has(e.title)) examSessions.set(e.title, e.date);
  }
  // Un jour férié national peut aussi avoir été saisi par l'école : une seule
  // annonce par nom et par jour.
  const upcomingHolidays = new Map<string, Announcement>();
  for (const h of holidays) {
    const key = `${h.name}|${isoDay(h.date)}`;
    if (h.date >= startOfToday && !upcomingHolidays.has(key)) {
      upcomingHolidays.set(key, { id: h.id, kind: "holiday", title: h.name, date: h.date });
    }
  }
  const announcements: Announcement[] = [
    ...[...examSessions.entries()].map(([title, date]) => ({
      id: `exam-${title}`,
      kind: "exam" as const,
      title,
      date,
    })),
    ...upcomingHolidays.values(),
  ]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 3);

  const firstName = (user.name ?? "").split(" ")[0] || ROLE_LABELS.DIRECTOR;

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        <HeroBanner
          schoolName={school?.name ?? "Madrasati"}
          greeting={`${t("dashboard.hello")}${locale === "ar" ? "، " : ", "}${firstName}`}
          subtitle={t("dashboard.overview")}
          dateLabel={`${t("dashboard.today")}, ${formatDateIn(locale, now, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}`}
          nowIso={now.toISOString()}
          quote={t("dashboard.quote")}
        />

        {yearEnded && currentYear && (
          <YearEndedBanner
            label={currentYear.label}
            endedOn={formatLongDate(currentYear.endDate)}
          />
        )}

        {showTrialWarning && (
          <Link
            href="/directeur/parametres"
            className="animate-page-in flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm shadow-sm transition-colors hover:bg-amber-100"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <Hourglass className="h-4.5 w-4.5" strokeWidth={2} />
              </span>
              <span>
                <span className="block font-medium text-amber-900">
                  {trialDaysLeft! > 0
                    ? t("dashboard.trialEndsIn").replace("{days}", String(trialDaysLeft))
                    : trialDaysLeft === 0
                      ? t("dashboard.trialEndsToday")
                      : t("dashboard.trialEnded")}
                </span>
                <span className="block text-xs text-amber-800/80">
                  {t("dashboard.trialCta")}
                </span>
              </span>
            </span>
            <span className="shrink-0 text-xs font-medium text-amber-700">
              {t("dashboard.seePlans")}
            </span>
          </Link>
        )}

        {atRiskEnabled && atRiskCount > 0 && (
          <Link
            href="/directeur/eleves-a-surveiller"
            className="animate-page-in flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm shadow-sm transition-colors hover:bg-amber-100"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <UserSearch className="h-4.5 w-4.5" strokeWidth={2} />
              </span>
              <span className="font-medium text-amber-900">
                {t("dashboard.atRiskBanner").replace("{count}", String(atRiskCount))}
              </span>
            </span>
            <span className="shrink-0 text-xs font-medium text-amber-700">
              {t("dashboard.seeDetail")}
            </span>
          </Link>
        )}

        {/* Quatre tuiles par rangée seulement quand la place le permet : entre
            1536 et 1760 px, la colonne de droite prend la largeur d'une tuile. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-2 3xl:grid-cols-4">
          <KpiCard
            label={t("dashboard.totalStudents")}
            value={String(studentCount)}
            icon={Users}
            tone="emerald"
            hint={
              newStudents > 0
                ? `+${newStudents} ${t("dashboard.thisMonthShort")}`
                : t("dashboard.noEnrollmentThisMonth")
            }
            hintPositive={newStudents > 0}
            trend={studentTrend}
            href="/directeur/eleves"
            delay={40}
          />
          <KpiCard
            label={t("nav.teachers")}
            value={String(teacherCount)}
            icon={Contact}
            tone="blue"
            hint={
              newTeachers > 0
                ? `+${newTeachers} ${t("dashboard.thisMonthShort")}`
                : t("dashboard.stableTeam")
            }
            hintPositive={newTeachers > 0}
            trend={teacherTrend}
            href="/directeur/enseignants"
            delay={80}
          />
          <KpiCard
            label={t("dashboard.attendanceOfDay")}
            value={`${attendanceRate}%`}
            icon={CircleCheck}
            tone="amber"
            hint={attendanceQuality(attendanceRate, todayAttendance.length > 0)}
            ring={todayAttendance.length > 0 ? attendanceRate : undefined}
            href="/directeur/presences"
            delay={120}
          />
          <KpiCard
            label={t("dashboard.moneyCollected")}
            value={formatMRU(collectedThisMonth)}
            icon={Wallet}
            tone="rose"
            hint={
              moneyChange == null
                ? t("dashboard.thisMonth")
                : `${moneyChange > 0 ? "+" : ""}${moneyChange}% ${t("dashboard.vsLastMonth")}`
            }
            hintPositive={moneyChange != null && moneyChange > 0}
            trend={moneyByMonth}
            href="/directeur/finance"
            delay={160}
          />
          <KpiCard
            label={t("dashboard.upcomingExams")}
            value={String(upcomingExamCount)}
            icon={CalendarCheck}
            tone="violet"
            hint={t("dashboard.thisWeek")}
            href="/directeur/examens"
            delay={200}
          />
          <KpiCard
            label={t("dashboard.activeClasses")}
            value={String(activeClasses)}
            icon={BookOpen}
            tone="cyan"
            hint={`${t("dashboard.outOf")} ${classes.length}`}
            href="/directeur/classes"
            delay={240}
          />
          <KpiCard
            label={t("nav.parents")}
            value={String(parentCount)}
            icon={Users}
            tone="pink"
            hint={t("dashboard.contacts")}
            href="/directeur/parents"
            delay={280}
          />
          <KpiCard
            label={t("dashboard.unpaid")}
            value={formatMRU(outstanding)}
            icon={HandCoins}
            tone="emerald"
            hint={t("dashboard.unpaidHint")}
            href="/directeur/finance?statut=impayes"
            delay={320}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] 2xl:grid-cols-1 3xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <AttendanceTrendCard week={weekPoints} months={monthPoints} delay={340} />
          <RecentActivityCard items={activity} delay={380} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] 2xl:grid-cols-1 3xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <UpcomingActivitiesCard items={upcoming} delay={420} />
          <ClassDistributionCard byClass={byClass} byLevel={byLevel} delay={460} />
        </div>
      </div>

      <aside className="grid content-start gap-6 md:grid-cols-2 2xl:grid-cols-1">
        <SchoolCard>
          <QuickActions />
          <HelpCard />
        </SchoolCard>
        <div className="grid content-start gap-6">
          <SchoolCalendar todayIso={isoDay(now)} events={calendarEvents} delay={200} />
          <AnnouncementsCard items={announcements} delay={260} />
        </div>
      </aside>
    </div>
  );
}
