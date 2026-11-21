import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkInResult,
  checkPosition,
  computeTeacherPay,
  distanceMeters,
  effectiveStatus,
  hoursLabel,
  isCheckInOpen,
  monthLabelOf,
  monthRange,
  plannedSessions,
  dmy,
  type PaySession,
  type PlannedSlot,
} from "../src/lib/timesheet";

const at = (iso: string) => new Date(`${iso}Z`);
const START = at("2026-11-16T08:00:00");

test("fenêtre de pointage : de 10 min avant à 15 min après le début", () => {
  assert.equal(isCheckInOpen(START, at("2026-11-16T07:49:59")), false);
  assert.equal(isCheckInOpen(START, at("2026-11-16T07:50:00")), true);
  assert.equal(isCheckInOpen(START, at("2026-11-16T08:15:00")), true);
  assert.equal(isCheckInOpen(START, at("2026-11-16T08:15:01")), false);
});

test("retard : au-delà de 5 min après le début, minutes comptées depuis le début", () => {
  assert.deepEqual(checkInResult(START, at("2026-11-16T07:52:00")), { status: "PRESENT", lateMinutes: 0 });
  assert.deepEqual(checkInResult(START, at("2026-11-16T08:05:00")), { status: "PRESENT", lateMinutes: 0 });
  assert.deepEqual(checkInResult(START, at("2026-11-16T08:05:30")), { status: "LATE", lateMinutes: 5 });
  assert.deepEqual(checkInResult(START, at("2026-11-16T08:12:00")), { status: "LATE", lateMinutes: 12 });
});

test("absence automatique : sans pointage à la fin de la séance", () => {
  const end = at("2026-11-16T09:00:00");
  assert.equal(effectiveStatus({ status: "PENDING", endsAt: end }, at("2026-11-16T08:59:59")), "PENDING");
  assert.equal(effectiveStatus({ status: "PENDING", endsAt: end }, end), "ABSENT");
  assert.equal(effectiveStatus({ status: "PRESENT", endsAt: end }, at("2026-11-16T10:00:00")), "PRESENT");
  assert.equal(effectiveStatus({ status: "EXCUSED", endsAt: end }, at("2026-11-16T10:00:00")), "EXCUSED");
});

test("GPS : accepté dans le rayon, refusé au-delà, refusé sans position de l'école", () => {
  const school = { latitude: 18.0866, longitude: -15.9785, radius: 150 };
  // ~100 m au nord (0,0009° de latitude ≈ 100 m).
  const near = checkPosition(school, { latitude: 18.0875, longitude: -15.9785 });
  assert.equal(near.ok, true);
  assert.ok(near.ok && near.distance > 90 && near.distance < 110);
  const far = checkPosition(school, { latitude: 18.0884, longitude: -15.9785 });
  assert.deepEqual(far.ok, false);
  assert.ok(!far.ok && far.reason === "TOO_FAR" && (far.distance ?? 0) > 190);
  assert.deepEqual(checkPosition({ latitude: null, longitude: null, radius: 150 }, { latitude: 18, longitude: -15 }), { ok: false, reason: "NOT_CONFIGURED" });
  assert.deepEqual(checkPosition(school, { latitude: "x", longitude: 2 }), { ok: false, reason: "INVALID" });
  assert.equal(checkPosition({ ...school, radius: 250 }, { latitude: 18.0884, longitude: -15.9785 }).ok, true, "rayon configurable");
  assert.ok(Math.abs(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }) - 111_195) < 50);
});

test("séances du jour : depuis l'emploi du temps, aucune un jour férié ni sans enseignant", () => {
  const slots: PlannedSlot[] = [
    { id: "s1", dayOfWeek: 1, startMinutes: 480, endMinutes: 540, classId: "c1", className: "1AS", subjectId: "m", subjectName: "Maths", teacherId: "t1" },
    { id: "s2", dayOfWeek: 1, startMinutes: 600, endMinutes: 690, classId: "c2", className: "2AS", subjectId: "p", subjectName: "Physique", teacherId: "t1" },
    { id: "s3", dayOfWeek: 1, startMinutes: 480, endMinutes: 540, classId: "c3", className: "3AS", subjectId: "a", subjectName: "Arabe", teacherId: null },
    { id: "s4", dayOfWeek: 2, startMinutes: 480, endMinutes: 540, classId: "c1", className: "1AS", subjectId: "m", subjectName: "Maths", teacherId: "t1" },
  ];
  const monday = at("2026-11-16T00:00:00");
  const sessions = plannedSessions(slots, monday, new Set());
  assert.deepEqual(sessions.map((s) => s.scheduleSlotId), ["s1", "s2"]);
  assert.equal(sessions[1].startsAt.toISOString(), "2026-11-16T10:00:00.000Z");
  assert.equal(sessions[1].endsAt.toISOString(), "2026-11-16T11:30:00.000Z");
  assert.deepEqual(plannedSessions(slots, monday, new Set(["2026-11-16"])), [], "jour férié : aucune séance");
});

const session = (over: Partial<PaySession> & { start: string; end: string }): PaySession => ({
  teacherId: "t1",
  replacementTeacherId: null,
  status: "PRESENT",
  lateMinutes: 0,
  startsAt: at(`2026-11-16T${over.start}:00`),
  endsAt: at(`2026-11-16T${over.end}:00`),
  ...over,
});
const NOW = at("2026-12-01T00:00:00");

test("paie : heures présent + retard + remplacements faits, × taux horaire", () => {
  const sessions = [
    session({ start: "08:00", end: "09:00" }), // 60
    session({ start: "09:00", end: "10:30", status: "LATE", lateMinutes: 12 }), // 90
    session({ start: "10:30", end: "11:30", status: "ABSENT" }),
    session({ start: "11:30", end: "12:30", status: "EXCUSED" }),
    session({ start: "14:00", end: "15:00", status: "REPLACED", replacementTeacherId: "t2" }), // va à t2
    session({ start: "15:00", end: "16:00", teacherId: "t3", status: "REPLACED", replacementTeacherId: "t1" }), // 60 pour t1
    session({ start: "16:00", end: "17:00", status: "PENDING" }), // passée sans pointage : absent
  ];
  const pay = computeTeacherPay("t1", 300, sessions, [], "PRORATA", NOW);
  assert.equal(pay.minutes, 210);
  assert.equal(pay.replacementMinutes, 60);
  assert.equal(pay.honoraires, 1050);
  assert.equal(pay.lateMinutes, 12);
  assert.equal(pay.lateDeduction, 60);
  assert.equal(pay.net, 990);
  assert.equal(pay.counts.ABSENT, 2, "la séance passée sans pointage compte absente");
  const t2 = computeTeacherPay("t2", 200, sessions, [], "PRORATA", NOW);
  assert.equal(t2.minutes, 60);
  assert.equal(t2.honoraires, 200);
});

test("paie : règle « pas de déduction des retards », avances et autres déductions", () => {
  const sessions = [session({ start: "08:00", end: "10:00", status: "LATE", lateMinutes: 20 })];
  const none = computeTeacherPay("t1", 300, sessions, [], "NONE", NOW);
  assert.equal(none.lateDeduction, 0);
  assert.equal(none.net, 600);
  const withAdjustments = computeTeacherPay(
    "t1",
    300,
    sessions,
    [
      { kind: "ADVANCE", amount: 200 },
      { kind: "OTHER", amount: 50 },
    ],
    "PRORATA",
    NOW,
  );
  assert.equal(withAdjustments.lateDeduction, 100);
  assert.equal(withAdjustments.advances, 200);
  assert.equal(withAdjustments.otherDeductions, 50);
  assert.equal(withAdjustments.deductions, 350);
  assert.equal(withAdjustments.net, 250);
});

test("paie : arrondi une seule fois au total, taux absent = 0", () => {
  const sessions = [1, 2, 3].map((i) => session({ start: `${String(7 + i).padStart(2, "0")}:00`, end: `${String(7 + i).padStart(2, "0")}:50` }));
  assert.equal(computeTeacherPay("t1", 100, sessions, [], "PRORATA", NOW).honoraires, 250);
  const noRate = computeTeacherPay("t1", null, sessions, [], "PRORATA", NOW);
  assert.equal(noRate.honoraires, 0);
  assert.equal(noRate.minutes, 150);
});

test("affichage : JJ/MM/AAAA, heures, mois", () => {
  assert.equal(dmy(at("2026-03-09T10:00:00")), "09/03/2026");
  assert.equal(hoursLabel(750), "12 h 30");
  assert.equal(hoursLabel(120), "2 h");
  assert.equal(monthLabelOf("2026-11"), "Novembre 2026");
  assert.equal(monthRange("2026-12")?.end.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.equal(monthRange("2026-13"), null);
});

test("mois consultables : depuis l'activation du pointage, 12 au plus, le plus récent d'abord", async () => {
  const { timesheetMonths } = await import("../src/lib/timesheet");
  assert.deepEqual(timesheetMonths(at("2026-10-15T00:00:00"), at("2026-12-03T09:00:00")), ["2026-12", "2026-11", "2026-10"]);
  assert.equal(timesheetMonths(null, at("2026-12-03T09:00:00")).length, 12);
});

test("activation par le directeur : le pointage commence le jour même, une réactivation garde la date de départ", async () => {
  const { timesheetSwitchData } = await import("../src/lib/timesheet");
  assert.deepEqual(timesheetSwitchData(true, null, at("2026-11-21T14:30:00")), {
    timesheetEnabled: true,
    timesheetStartDate: at("2026-11-21T00:00:00"),
    timesheetGeneratedThrough: at("2026-11-20T00:00:00"),
  });
  assert.deepEqual(timesheetSwitchData(true, at("2026-10-01T00:00:00"), at("2026-11-21T14:30:00")), { timesheetEnabled: true });
  assert.deepEqual(timesheetSwitchData(false, at("2026-10-01T00:00:00"), at("2026-11-21T14:30:00")), { timesheetEnabled: false });
});

test("prix de l'heure par matière : Physique 1 300 MRU/h, Maths 200 MRU/h, calculé à chaque séance pointée", () => {
  const physique = { subjectName: "Physique", subjectRate: 1300 };
  const maths = { subjectName: "Maths", subjectRate: 200 };
  const sessions = [
    session({ start: "08:00", end: "09:00", ...physique }),
    session({ start: "09:00", end: "11:00", ...maths }),
    session({ start: "11:00", end: "12:00", ...physique, status: "LATE", lateMinutes: 12 }),
    session({ start: "15:00", end: "16:00", ...physique, status: "ABSENT" }),
  ];
  const pay = computeTeacherPay("t1", 500, sessions, [], "PRORATA", NOW);
  // 2 h de Physique × 1 300 + 2 h de Maths × 200 ; l'absence ne compte pas.
  assert.equal(pay.honoraires, 2 * 1300 + 2 * 200);
  assert.deepEqual(
    pay.parts?.map((p) => [p.subject, p.rate, p.minutes, p.amount]),
    [
      ["Maths", 200, 120, 400],
      ["Physique", 1300, 120, 2600],
    ],
  );
  // Retard au prix de la matière du cours : 12 min × 1 300 / 60 = 260.
  assert.equal(pay.lateDeduction, 260);
  assert.equal(pay.net, 3000 - 260);
  // Une séance de plus pointée : la paie suit d'elle-même.
  const more = computeTeacherPay("t1", 500, [...sessions, session({ start: "16:00", end: "17:00", ...maths })], [], "PRORATA", NOW);
  assert.equal(more.honoraires, pay.honoraires + 200);
});

test("matière sans prix : taux de l'enseignant ; sans aucun prix : 0 MRU et signalé", () => {
  const sessions = [
    session({ start: "08:00", end: "09:00", subjectName: "Physique", subjectRate: 1300 }),
    session({ start: "09:00", end: "10:00", subjectName: "Dessin", subjectRate: null }),
  ];
  const withTeacherRate = computeTeacherPay("t1", 150, sessions, [], "PRORATA", NOW);
  assert.equal(withTeacherRate.honoraires, 1300 + 150);
  assert.equal(withTeacherRate.unpricedMinutes, 0);
  const noRate = computeTeacherPay("t1", null, sessions, [], "PRORATA", NOW);
  assert.equal(noRate.honoraires, 1300);
  assert.equal(noRate.unpricedMinutes, 60);
});

test("remplacement : payé au remplaçant, au prix de la matière du cours", () => {
  const sessions = [session({ start: "08:00", end: "10:00", subjectName: "Physique", subjectRate: 1300, status: "REPLACED", replacementTeacherId: "t2" })];
  assert.equal(computeTeacherPay("t2", 100, sessions, [], "PRORATA", NOW).honoraires, 2600);
  assert.equal(computeTeacherPay("t1", 100, sessions, [], "PRORATA", NOW).honoraires, 0);
});

test("taux affiché : un seul prix, ou chaque matière avec le sien ; anciennes paies validées : taux de l'enseignant", async () => {
  const { payRates } = await import("../src/lib/timesheet");
  const one = computeTeacherPay("t1", null, [session({ start: "08:00", end: "09:00", subjectName: "Maths", subjectRate: 200 })], [], "PRORATA", NOW);
  assert.deepEqual(payRates(one), [{ subject: "", rate: 200 }]);
  const two = computeTeacherPay(
    "t1",
    null,
    [session({ start: "08:00", end: "09:00", subjectName: "Maths", subjectRate: 200 }), session({ start: "09:00", end: "10:00", subjectName: "Physique", subjectRate: 1300 })],
    [],
    "PRORATA",
    NOW,
  );
  assert.deepEqual(payRates(two), [
    { subject: "Maths", rate: 200 },
    { subject: "Physique", rate: 1300 },
  ]);
  assert.deepEqual(payRates({ hourlyRate: 300 }), [{ subject: "", rate: 300 }]);
});
