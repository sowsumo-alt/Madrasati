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
import { useLanguage } from "@/lib/i18n/language-provider";
import { TERMS } from "../schema";

/** Recherche et filtres de la liste des examens : trimestre, classe, matière. */
export function ExamsToolbar({
  query,
  onQueryChange,
  term,
  onTermChange,
  classFilter,
  onClassFilterChange,
  subjectFilter,
  onSubjectFilterChange,
  classes,
  subjects,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  term: string;
  onTermChange: (value: string) => void;
  classFilter: string;
  onClassFilterChange: (value: string) => void;
  subjectFilter: string;
  onSubjectFilterChange: (value: string) => void;
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
}) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface p-3 shadow-soft lg:flex-row lg:items-center">
      <div className="relative min-w-0 lg:flex-1">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("exams.searchPlaceholder")}
          aria-label={t("common.search")}
          className="ps-9"
        />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:shrink-0">
        <Select value={term} onValueChange={onTermChange}>
          <SelectTrigger className="lg:w-44" aria-label={t("exams.allTerms")}>
            <SelectValue>{term === "ALL" ? t("exams.allTerms") : term}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("exams.allTerms")}</SelectItem>
            {TERMS.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={classFilter} onValueChange={onClassFilterChange}>
          <SelectTrigger className="lg:w-44" aria-label={t("students.allClasses")}>
            <SelectValue>
              {classFilter === "ALL"
                ? t("students.allClasses")
                : (classes.find((c) => c.id === classFilter)?.name ?? t("students.allClasses"))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("students.allClasses")}</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={subjectFilter} onValueChange={onSubjectFilterChange}>
          <SelectTrigger className="lg:w-52" aria-label={t("exams.allSubjects")}>
            <SelectValue>
              {subjectFilter === "ALL"
                ? t("exams.allSubjects")
                : (subjects.find((s) => s.id === subjectFilter)?.name ?? t("exams.allSubjects"))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("exams.allSubjects")}</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
