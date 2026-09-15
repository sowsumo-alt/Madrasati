"use client";

import Link from "next/link";
import { BookOpen, UserRound, Users } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { subjectStyle } from "@/components/subjects/subject-style";
import { missingSetup, type ClassTone } from "@/lib/classes-list";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import type { ClassRow } from "../classes-view";
import { ClassPill, IncompleteBadge } from "./class-badges";

/**
 * Fiche d'une classe (bouton « œil ») : remplissage, professeur principal et
 * matières avec leur enseignant — avec l'accès direct à la gestion des
 * matières et à la liste des élèves de la classe.
 */
export function ClassDetailSheet({
  target,
  onClose,
  onManageSubjects,
}: {
  target: { row: ClassRow; tone: ClassTone } | null;
  onClose: () => void;
  onManageSubjects: (row: ClassRow) => void;
}) {
  const { t } = useLanguage();
  const row = target?.row ?? null;
  const missing = row ? missingSetup(row) : [];
  const fill = row && row.capacity > 0 ? Math.min(row.studentCount / row.capacity, 1) : 0;
  const placesLeft = row ? Math.max(row.capacity - row.studentCount, 0) : 0;

  return (
    <Sheet open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent closeLabel={t("common.close")}>
        {target && row && (
          <>
            <div className="border-b border-primary-100 bg-gradient-to-br from-primary-50 via-surface to-emerald-50 px-6 pb-5 pt-8">
              <div className="flex items-center gap-4 pe-6">
                <ClassPill name={row.name} tone={target.tone} className="h-14 min-w-[4.5rem] text-xl" />
                <div className="min-w-0">
                  <SheetTitle className="text-xl font-bold leading-tight text-foreground">
                    {t("classes.colClass")} {row.name}
                  </SheetTitle>
                  <SheetDescription className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-foreground/55">
                    <span>
                      {t("classes.colLevel")} {row.level}
                    </span>
                    {missing.length > 0 && (
                      <IncompleteBadge
                        label={t("classes.incomplete")}
                        title={t("classes.incompleteTitle").replace(
                          "{items}",
                          missing.map((m) => t(`classes.missing.${m}` as TranslationKey)).join(", "),
                        )}
                      />
                    )}
                  </SheetDescription>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <section className="rounded-2xl bg-primary-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground/60">
                    <Users className="h-4 w-4 text-primary-600" />
                    {t("classes.enrolled")}
                  </p>
                  <p
                    className="text-xl font-bold text-primary-900"
                    dir="ltr"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {row.studentCount} / {row.capacity}
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
                  <div
                    className={cn("h-full rounded-full", placesLeft === 0 ? "bg-amber-500" : "bg-primary-600")}
                    style={{ width: `${fill * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-foreground/55">
                  {placesLeft === 0
                    ? t("classes.full")
                    : t("classes.placesLeft").replace("{count}", String(placesLeft))}
                </p>
              </section>

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 px-4 py-3">
                <span className="text-sm text-foreground/55">{t("classes.colMainTeacher")}</span>
                <span
                  className={cn(
                    "flex min-w-0 items-center gap-2 text-sm font-medium",
                    row.mainTeacher ? "text-foreground" : "text-foreground/40",
                  )}
                >
                  <UserRound className={cn("h-4 w-4 shrink-0", row.mainTeacher ? "text-primary-600" : "")} />
                  <span className="truncate">
                    {row.mainTeacher
                      ? `${row.mainTeacher.firstName} ${row.mainTeacher.lastName}`
                      : t("classes.none")}
                  </span>
                </span>
              </div>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-700">
                  {t("classes.subjectsAndTeachers")}
                </h3>
                {row.assignments.length === 0 ? (
                  <p className="mt-2 rounded-xl bg-surface-muted/50 px-4 py-3 text-sm text-foreground/45">
                    {t("classes.noSubjectYet")}
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {row.assignments.map((a) => {
                      const style = subjectStyle(a.subjectName);
                      const Icon = style.icon;
                      return (
                        <li
                          key={a.subjectId}
                          className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2.5"
                        >
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                              style.badge,
                            )}
                          >
                            <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{a.subjectName}</p>
                            <p
                              className={cn(
                                "truncate text-xs",
                                a.teacherName ? "text-foreground/55" : "text-amber-700",
                              )}
                            >
                              {a.teacherName ?? t("classes.unassigned")}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border px-6 py-4">
              <Button variant="secondary" onClick={() => onManageSubjects(row)}>
                <BookOpen className="h-4 w-4" />
                {t("classes.manageSubjects")}
              </Button>
              <Link
                href={`/directeur/eleves?classe=${encodeURIComponent(row.id)}`}
                className={buttonVariants()}
              >
                <Users className="h-4 w-4" />
                {t("classes.seeStudents")}
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
