import { balanceOf, formatMoney, type AmountUnit } from "@/lib/money";
import { effectiveDueDate, type DueRule } from "@/lib/due-rule";
import { joinNames } from "@/lib/message-personalize";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

/**
 * Rappels du mois : les familles qui ont un mois dû non réglé, ce qu'elles
 * doivent exactement, et le message WhatsApp à leur envoyer.
 *
 * « Dû » suit la même règle que partout ailleurs (balanceOf + la règle
 * d'échéance de l'école) : un mois payé d'avance est soldé et n'apparaît
 * jamais, un mois pas encore arrivé non plus.
 *
 * Sans accès à la base : testé à part (tests/payment-reminder.test.ts).
 */

export interface ReminderFee {
  studentId: string;
  label: string;
  amount: number;
  paid: number;
  dueDate: Date;
  periodStart: Date | null;
  /** Fiche familiale : la ligne vaut pour toute la famille. */
  familyParentId: string | null;
}

export interface ReminderStudent {
  id: string;
  name: string;
  className: string | null;
  active: boolean;
  /** Parent principal ; null pour un élève sans parent enregistré. */
  parentId: string | null;
}

export interface ReminderParent {
  id: string;
  name: string;
  phone: string | null;
}

export interface ReminderLine {
  label: string;
  amount: number;
}

export interface ReminderGroup {
  /** L'id du parent, ou « student:<id> » pour un élève sans parent. */
  key: string;
  parentId: string | null;
  parentName: string | null;
  phone: string | null;
  children: { id: string; name: string; className: string | null }[];
  /** Les mois (et autres frais) dus, du plus ancien au plus récent. */
  lines: ReminderLine[];
  total: number;
  /** Depuis quand le plus ancien est dû. */
  oldestDue: Date;
}

/** « Frais de scolarité — Octobre 2026 » → « Octobre 2026 ». */
export function reminderLabel(label: string): string {
  return label.replace(/^Frais de scolarité\s*[—-]\s*/, "").trim() || label;
}

export function reminderGroups(input: {
  fees: ReminderFee[];
  students: ReminderStudent[];
  parents: ReminderParent[];
  rule: DueRule;
  now: Date;
}): ReminderGroup[] {
  const { rule, now } = input;
  const students = new Map(input.students.map((s) => [s.id, s]));
  const parents = new Map(input.parents.map((p) => [p.id, p]));

  type Draft = { key: string; parentId: string | null; childIds: Set<string>; family: boolean; lines: { label: string; amount: number; due: Date }[] };
  const drafts = new Map<string, Draft>();

  for (const fee of input.fees) {
    const dueDate = effectiveDueDate(fee, rule);
    // La règle commune : seul le reste dû d'une échéance arrivée compte.
    const due = balanceOf([{ amount: fee.amount, paid: fee.paid, dueDate }], now).due;
    if (due <= 0) continue;
    const student = students.get(fee.studentId);
    const parentId = fee.familyParentId ?? student?.parentId ?? null;
    const key = parentId ?? `student:${fee.studentId}`;
    const draft = drafts.get(key) ?? { key, parentId, childIds: new Set<string>(), family: false, lines: [] };
    draft.childIds.add(fee.studentId);
    if (fee.familyParentId) draft.family = true;
    draft.lines.push({ label: reminderLabel(fee.label), amount: due, due: dueDate });
    drafts.set(key, draft);
  }

  const groups: ReminderGroup[] = [];
  for (const draft of drafts.values()) {
    // Fiche familiale : le rappel nomme tous les enfants inscrits de la famille.
    if (draft.family && draft.parentId) {
      for (const s of input.students) if (s.parentId === draft.parentId && s.active) draft.childIds.add(s.id);
    }
    // Deux enfants dus pour octobre : une seule ligne « Octobre 2026 », au total des deux.
    const byLabel = new Map<string, { label: string; amount: number; due: Date }>();
    for (const line of draft.lines.sort((a, b) => a.due.getTime() - b.due.getTime())) {
      const seen = byLabel.get(line.label);
      if (seen) seen.amount += line.amount;
      else byLabel.set(line.label, { ...line });
    }
    const lines = [...byLabel.values()].map(({ label, amount }) => ({ label, amount }));
    const parent = draft.parentId ? parents.get(draft.parentId) ?? null : null;
    groups.push({
      key: draft.key,
      parentId: draft.parentId,
      parentName: parent?.name ?? null,
      phone: parent?.phone || null,
      children: [...draft.childIds]
        .map((id) => students.get(id))
        .filter((s): s is ReminderStudent => Boolean(s))
        .sort((a, b) => a.name.localeCompare(b.name, "fr"))
        .map((s) => ({ id: s.id, name: s.name, className: s.className })),
      lines,
      total: lines.reduce((sum, l) => sum + l.amount, 0),
      oldestDue: draft.lines[0].due,
    });
  }
  // Les plus anciens impayés d'abord, puis par nom.
  return groups.sort(
    (a, b) => a.oldestDue.getTime() - b.oldestDue.getTime() || (a.parentName ?? "").localeCompare(b.parentName ?? "", "fr"),
  );
}

/**
 * Le message WhatsApp d'un rappel : le parent, les enfants, chaque mois dû
 * avec son montant, et le total exact. Refuse de produire un message sans
 * montant — un rappel « de  MRU » ne part jamais.
 */
export function reminderMessage(group: ReminderGroup, context: { schoolName: string; unit: AmountUnit }): string {
  if (group.lines.length === 0 || group.total <= 0 || group.lines.some((l) => !(l.amount > 0))) {
    throw new Error("Rappel sans montant dû : aucun message à envoyer.");
  }
  const school = context.schoolName.replace(/\s+/g, " ").trim();
  const children = joinNames(
    group.children.map((c) => (c.className ? `${c.name} (${c.className})` : c.name)),
    "fr",
  );
  return [
    `Bonjour${group.parentName ? ` ${group.parentName}` : ""},`,
    "",
    `L'école ${school} vous rappelle qu'il reste à régler${children ? ` pour ${children}` : ""} :`,
    ...group.lines.map((l) => `• ${l.label} : ${formatMoney(l.amount, context.unit)}`),
    "",
    `Montant dû : ${formatMoney(group.total, context.unit)}.`,
    "",
    "Merci de passer à l'école pour régler. Si vous avez déjà payé, merci de ne pas tenir compte de ce message.",
    school,
  ].join("\n");
}

/** Le numéro au format international : un numéro local à 8 chiffres reçoit l'indicatif 222. */
export function reminderPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 8 ? `222${digits}` : digits;
}

/** Le lien wa.me du rappel, au message exact. */
export function reminderWhatsAppUrl(phone: string, message: string): string {
  return buildWhatsAppUrl(reminderPhone(phone), message);
}
