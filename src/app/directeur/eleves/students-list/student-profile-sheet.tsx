"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { FileText, MessageCircle, Pencil, Phone } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateIn } from "@/lib/format";
import { buildTelUrl, buildWhatsAppUrl } from "@/lib/whatsapp";
import { joinFullName } from "@/lib/student-form";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import type { StudentRow } from "../students-view";
import { StudentAvatar } from "./student-avatar";
import { STATUS_KEYS, STATUS_VARIANT } from "./student-status";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-foreground/55">{label}</dt>
      <dd className="min-w-0 text-end text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-700">{title}</h3>
      <dl className="mt-1 divide-y divide-border/70">{children}</dl>
    </section>
  );
}

/**
 * Fiche de l'élève en panneau latéral (bouton « œil ») : tout le dossier en
 * lecture, avec les gestes qui en découlent — joindre le parent, modifier,
 * ouvrir le bulletin — sans quitter la liste.
 */
export function StudentProfileSheet({
  student,
  currentYearLabel,
  schoolName,
  onClose,
  onEdit,
}: {
  student: StudentRow | null;
  currentYearLabel: string | null;
  schoolName: string;
  onClose: () => void;
  onEdit: (student: StudentRow) => void;
}) {
  const { t, locale } = useLanguage();
  const empty = <span className="font-normal text-foreground/35">{t("students.notProvided")}</span>;
  const longDate = (iso: string) =>
    formatDateIn(locale, iso, { day: "numeric", month: "long", year: "numeric" });

  return (
    <Sheet open={Boolean(student)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent closeLabel={t("common.close")}>
        {student && (
          <>
            <div className="border-b border-primary-200 bg-gradient-to-br from-primary-50 via-surface to-emerald-50 px-6 pb-5 pt-8">
              <div className="flex items-center gap-4 pe-6">
                <StudentAvatar
                  firstName={student.firstName}
                  lastName={student.lastName}
                  photoUrl={student.photoUrl}
                  size="lg"
                />
                <div className="min-w-0">
                  <SheetTitle className="text-xl font-bold leading-tight text-foreground">
                    {student.firstName} {student.lastName}
                  </SheetTitle>
                  <SheetDescription className="mt-2 flex flex-wrap items-center gap-1.5">
                    {student.className ? (
                      <span className="inline-flex rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-800">
                        {student.className}
                      </span>
                    ) : (
                      <Badge variant="warning">{t("students.noClass")}</Badge>
                    )}
                    <Badge variant={STATUS_VARIANT[student.status]}>
                      {STATUS_KEYS[student.status] ? t(STATUS_KEYS[student.status]) : student.status}
                    </Badge>
                  </SheetDescription>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <Section title={t("students.sectionIdentity")}>
                <Row label={t("students.dateOfBirth")}>
                  {student.dateOfBirth ? longDate(student.dateOfBirth) : empty}
                </Row>
                <Row label={t("students.placeOfBirth")}>{student.placeOfBirth || empty}</Row>
                <Row label={t("students.gender")}>
                  {student.gender ? t(`students.gender.${student.gender}` as TranslationKey) : empty}
                </Row>
                <Row label={t("students.nationality")}>{student.nationality || empty}</Row>
              </Section>

              <Section title={t("students.sectionSchooling")}>
                <Row label={t("students.class")}>{student.className || empty}</Row>
                <Row label={t("students.schoolYear")}>
                  {student.className && currentYearLabel ? currentYearLabel : empty}
                </Row>
                <Row label={t("students.enrollmentDate")}>{longDate(student.enrollmentDate)}</Row>
              </Section>

              <Section title={t("students.sectionParents")}>
                <Row label={t("students.fatherName")}>
                  {student.parent
                    ? joinFullName(student.parent.firstName, student.parent.lastName)
                    : empty}
                </Row>
                <Row label={t("students.parentPhone")}>
                  {student.parent ? (
                    <span className="flex items-center justify-end gap-2">
                      <span dir="ltr">{student.parent.phone}</span>
                      <a
                        href={buildWhatsAppUrl(
                          student.parent.phone,
                          `Bonjour, ici ${schoolName} au sujet de votre enfant ${student.firstName} ${student.lastName}.`,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t("students.contactWhatsapp")}
                        aria-label={t("students.contactWhatsapp")}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                      <a
                        href={buildTelUrl(student.parent.phone)}
                        title={t("students.callParent")}
                        aria-label={t("students.callParent")}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    </span>
                  ) : (
                    empty
                  )}
                </Row>
                <Row label={t("students.address")}>{student.parent?.address || empty}</Row>
                <Row label={t("students.motherName")}>{student.motherName || empty}</Row>
              </Section>
            </div>

            <div className="flex gap-2 border-t border-border px-6 py-4">
              <Button className="flex-1" onClick={() => onEdit(student)}>
                <Pencil className="h-4 w-4" />
                {t("common.edit")}
              </Button>
              <Link
                href={`/directeur/bulletins/${student.id}`}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-primary-800 transition-colors hover:bg-surface-muted"
              >
                <FileText className="h-4 w-4" />
                {t("students.viewReportCard")}
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
