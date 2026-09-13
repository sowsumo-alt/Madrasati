"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { StudentClassOption } from "../student-form-dialog";
import { STATUS_KEYS, STUDENT_STATUSES, type StudentStatus } from "./student-status";

export type StatusFilter = "ALL" | StudentStatus;
/** "ALL", "NONE" (élèves sans classe) ou l'identifiant d'une classe. */
export type ClassFilter = string;

/**
 * Barre de recherche et de filtres de la liste des élèves : recherche, classes
 * en pastilles (accès en un clic), puis classe et statut en listes déroulantes.
 * Pastilles et liste de classes pilotent le même filtre.
 */
export function StudentsToolbar({
  query,
  onQueryChange,
  classFilter,
  onClassFilterChange,
  statusFilter,
  onStatusFilterChange,
  classes,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  classFilter: ClassFilter;
  onClassFilterChange: (value: ClassFilter) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  classes: StudentClassOption[];
}) {
  const { t } = useLanguage();

  const chip = (active: boolean) =>
    cn(
      "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
      active
        ? "bg-primary-700 text-white shadow-sm"
        : "bg-surface-muted text-foreground/65 hover:bg-primary-50 hover:text-primary-800",
    );

  const classLabel =
    classFilter === "ALL"
      ? t("students.allClasses")
      : classFilter === "NONE"
        ? t("students.noClass")
        : (classes.find((c) => c.id === classFilter)?.name ?? t("students.allClasses"));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface p-3 shadow-soft lg:flex-row lg:items-center">
      <div className="relative lg:w-72 lg:shrink-0">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("students.searchPlaceholder")}
          aria-label={t("common.search")}
          className="ps-9"
        />
      </div>

      <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => onClassFilterChange("ALL")}
          aria-pressed={classFilter === "ALL"}
          className={chip(classFilter === "ALL")}
        >
          {t("common.all")}
        </button>
        {classes.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onClassFilterChange(c.id)}
            aria-pressed={classFilter === c.id}
            className={chip(classFilter === c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:shrink-0">
        <Select value={classFilter} onValueChange={onClassFilterChange}>
          <SelectTrigger className="lg:w-44" aria-label={t("students.allClasses")}>
            <SelectValue>{classLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("students.allClasses")}</SelectItem>
            <SelectItem value="NONE">{t("students.noClass")}</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}
        >
          <SelectTrigger className="lg:w-44" aria-label={t("students.allStatuses")}>
            <SelectValue>
              {statusFilter === "ALL" ? t("students.allStatuses") : t(STATUS_KEYS[statusFilter])}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("students.allStatuses")}</SelectItem>
            {STUDENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(STATUS_KEYS[s])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
