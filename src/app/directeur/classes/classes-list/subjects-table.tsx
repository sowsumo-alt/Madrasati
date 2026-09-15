import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { SubjectRow } from "../classes-view";

interface SubjectHandlers {
  onEdit: (subject: SubjectRow) => void;
  onDelete: (subject: SubjectRow) => void;
  onReactivate: (subject: SubjectRow) => void;
}

const actionButton =
  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";

function SubjectActions({ subject, onEdit, onDelete, onReactivate }: SubjectHandlers & { subject: SubjectRow }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        title={t("classes.editSubject")}
        aria-label={`${t("classes.editSubject")} ${subject.name}`}
        onClick={() => onEdit(subject)}
        className={cn(actionButton, "bg-slate-50 text-primary-700 hover:bg-primary-50")}
      >
        <Pencil className="h-4 w-4" />
      </button>
      {/* Une matière désactivée se réactive d'un clic : la corbeille n'a plus
          rien à faire, puisqu'elle n'a été désactivée que pour garder ses notes. */}
      {subject.isActive ? (
        <button
          type="button"
          title={t("classes.deleteSubject")}
          aria-label={`${t("classes.deleteSubject")} ${subject.name}`}
          onClick={() => onDelete(subject)}
          className={cn(actionButton, "bg-red-50 text-red-600 hover:bg-red-100")}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          title={t("classes.reactivateSubject")}
          aria-label={`${t("classes.reactivateSubject")} ${subject.name}`}
          onClick={() => onReactivate(subject)}
          className={cn(actionButton, "bg-primary-50 text-primary-700 hover:bg-primary-100")}
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function SubjectName({ subject }: { subject: SubjectRow }) {
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <span className={cn("font-bold", subject.isActive ? "text-foreground" : "text-foreground/50")}>
        {subject.name}
      </span>
      {subject.nameAr && (
        <span className="text-slate-500" dir="rtl" lang="ar">
          {subject.nameAr}
        </span>
      )}
    </span>
  );
}

function StatusPill({ active }: { active: boolean }) {
  const { t } = useLanguage();
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-0.5 text-sm font-semibold",
        active ? "bg-primary-100/70 text-primary-700" : "bg-slate-100 text-slate-500",
      )}
    >
      {active ? t("classes.active") : t("classes.inactive")}
    </span>
  );
}

const th = "px-4 py-2 text-start text-xs font-semibold uppercase tracking-wide text-primary-700";
const td = "px-4 py-1 first:rounded-s-xl last:rounded-e-xl";

/** Tableau des matières de l'école ; une carte par matière sur téléphone. */
export function SubjectsTable({ subjects, ...handlers }: SubjectHandlers & { subjects: SubjectRow[] }) {
  const { t } = useLanguage();

  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl bg-primary-50/60 px-1 pb-1 md:block">
        <table className="w-full min-w-[36rem] border-separate border-spacing-y-[3px] text-sm">
          <thead>
            <tr>
              <th className={cn(th, "w-[43%]")}>{t("classes.subject")}</th>
              <th className={cn(th, "w-[20%]")}>{t("classes.coefficient")}</th>
              <th className={th}>{t("classes.status")}</th>
              <th className={cn(th, "text-end")}>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id} className="bg-surface transition-colors hover:bg-primary-50/30">
                <td className={td}>
                  <SubjectName subject={s} />
                </td>
                <td className={cn(td, "text-slate-700")}>{s.coefficient}</td>
                <td className={td}>
                  <StatusPill active={s.isActive} />
                </td>
                <td className={td}>
                  <SubjectActions subject={s} {...handlers} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2.5 md:hidden">
        {subjects.map((s) => (
          <li key={s.id} className="rounded-2xl border border-border/60 bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <SubjectName subject={s} />
              <SubjectActions subject={s} {...handlers} />
            </div>
            <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
              <StatusPill active={s.isActive} />
              <span>
                {t("classes.coefficient")} {s.coefficient}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
