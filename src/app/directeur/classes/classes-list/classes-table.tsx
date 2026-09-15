import { BookOpen, Eye, Pencil, Trash2, UserRound, UsersRound } from "lucide-react";
import { missingSetup, type ClassTone } from "@/lib/classes-list";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import type { ClassRow } from "../classes-view";
import { ClassPill, IncompleteBadge } from "./class-badges";

export interface ClassTableRow {
  row: ClassRow;
  tone: ClassTone;
}

interface RowHandlers {
  onEdit: (row: ClassRow) => void;
  onView: (row: ClassRow) => void;
  onDelete: (row: ClassRow) => void;
}

const actionButton =
  "flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";

function RowActions({ row, onEdit, onView, onDelete }: RowHandlers & { row: ClassRow }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        title={t("classes.editClass")}
        aria-label={`${t("classes.editClass")} ${row.name}`}
        onClick={() => onEdit(row)}
        className={cn(actionButton, "bg-primary-50 text-primary-700 hover:bg-primary-100")}
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        title={t("classes.viewClass")}
        aria-label={`${t("classes.viewClass")} ${row.name}`}
        onClick={() => onView(row)}
        className={cn(actionButton, "bg-slate-50 text-primary-500 hover:bg-primary-50 hover:text-primary-700")}
      >
        <Eye className="h-4 w-4" />
      </button>
      <button
        type="button"
        title={t("classes.deleteClass")}
        aria-label={`${t("classes.deleteClass")} ${row.name}`}
        onClick={() => onDelete(row)}
        className={cn(actionButton, "bg-red-50 text-red-600 hover:bg-red-100")}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function useIncomplete(row: ClassRow) {
  const { t } = useLanguage();
  const missing = missingSetup(row);
  if (missing.length === 0) return null;
  const items = missing.map((m) => t(`classes.missing.${m}` as TranslationKey)).join(", ");
  return { label: t("classes.incomplete"), title: t("classes.incompleteTitle").replace("{items}", items) };
}

function NameCell({ row, tone }: ClassTableRow) {
  const incomplete = useIncomplete(row);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ClassPill name={row.name} tone={tone} />
      {incomplete && <IncompleteBadge {...incomplete} />}
    </div>
  );
}

function StudentsCell({ row }: { row: ClassRow }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-slate-700">
      <UsersRound className="h-[18px] w-[18px] shrink-0 text-primary-600" />
      <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums" }}>
        {row.studentCount} / {row.capacity}
      </span>
    </span>
  );
}

function TeacherCell({ row }: { row: ClassRow }) {
  const { t } = useLanguage();
  return row.mainTeacher ? (
    <span className="inline-flex min-w-0 items-center gap-2.5 text-slate-700">
      <UserRound className="h-[18px] w-[18px] shrink-0 text-primary-600" />
      <span className="truncate">
        {row.mainTeacher.firstName} {row.mainTeacher.lastName}
      </span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-2.5 text-slate-400">
      <UserRound className="h-[18px] w-[18px] shrink-0 text-slate-500" />
      {t("classes.none")}
    </span>
  );
}

function SubjectsCell({ row }: { row: ClassRow }) {
  const { t } = useLanguage();
  const count = row.assignments.length;
  return (
    <span className="inline-flex items-center gap-2.5 text-slate-700">
      <BookOpen className={cn("h-[18px] w-[18px] shrink-0", count > 0 ? "text-primary-700" : "text-slate-500")} />
      {t("classes.subjectCount").replace("{count}", String(count))}
    </span>
  );
}

const th = "px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-primary-700";
const td = "px-4 py-2.5 first:rounded-s-xl last:rounded-e-xl";

/**
 * Tableau des classes : une ligne blanche par classe sur fond vert d'eau.
 * Sur téléphone, chaque classe devient une carte.
 */
export function ClassesTable({ rows, ...handlers }: RowHandlers & { rows: ClassTableRow[] }) {
  const { t } = useLanguage();

  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl bg-primary-50/60 px-1 pb-1 md:block">
        <table className="w-full min-w-[42rem] border-separate border-spacing-y-[3px] text-sm">
          <thead>
            <tr>
              <th className={th}>{t("classes.colClass")}</th>
              <th className={cn(th, "hidden xl:table-cell")}>{t("classes.colLevel")}</th>
              <th className={th}>{t("classes.students")}</th>
              <th className={th}>{t("classes.colMainTeacher")}</th>
              <th className={th}>{t("classes.subjects")}</th>
              <th className={cn(th, "text-end")}>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, tone }) => (
              <tr key={row.id} className="bg-surface transition-colors hover:bg-primary-50/30">
                <td className={td}>
                  <NameCell row={row} tone={tone} />
                </td>
                <td className={cn(td, "hidden text-slate-700 xl:table-cell")}>{row.level}</td>
                <td className={td}>
                  <StudentsCell row={row} />
                </td>
                <td className={cn(td, "max-w-[16rem]")}>
                  <TeacherCell row={row} />
                </td>
                <td className={td}>
                  <SubjectsCell row={row} />
                </td>
                <td className={td}>
                  <RowActions row={row} {...handlers} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2.5 md:hidden">
        {rows.map(({ row, tone }) => (
          <li key={row.id} className="rounded-2xl border border-border/60 bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <NameCell row={row} tone={tone} />
              <RowActions row={row} {...handlers} />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
              <StudentsCell row={row} />
              <TeacherCell row={row} />
              <SubjectsCell row={row} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
