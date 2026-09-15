"use client";

import { Plus, School, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { ChildDraft, FieldErrors } from "./enrollment-draft";

export interface EnrollmentClassOption {
  id: string;
  name: string;
}

function GenderToggle({
  id,
  value,
  onChange,
}: {
  id: string;
  value: ChildDraft["gender"];
  onChange: (gender: "M" | "F") => void;
}) {
  const { t } = useLanguage();
  return (
    <div id={id} role="radiogroup" aria-label={t("students.gender")} className="grid grid-cols-2 gap-2">
      {(["M", "F"] as const).map((g) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={value === g}
          onClick={() => onChange(g)}
          className={cn(
            "h-10 rounded-lg border text-sm font-medium transition-colors",
            value === g
              ? "border-primary-500 bg-primary-50 text-primary-900 ring-1 ring-primary-500"
              : "border-border bg-surface text-foreground/70 hover:bg-surface-muted",
          )}
        >
          {t(g === "M" ? "students.gender.M" : "students.gender.F")}
        </button>
      ))}
    </div>
  );
}

/**
 * Étape 2 : chaque enfant sur sa carte — prénom, nom, date de naissance,
 * genre et classe — sans ressaisir le parent. « Ajouter un autre enfant »
 * en ajoute autant que nécessaire.
 */
export function ChildrenStep({
  entries,
  errors,
  classes,
  onChange,
  onAdd,
  onRemove,
}: {
  entries: ChildDraft[];
  errors: Record<string, FieldErrors>;
  classes: EnrollmentClassOption[];
  onChange: (key: string, patch: Partial<ChildDraft>) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="space-y-3">
      {entries.map((child, index) => {
        const e = errors[child.key] ?? {};
        const id = (field: string) => `${child.key}-${field}`;
        const className = classes.find((c) => c.id === child.classId)?.name;
        return (
          <section
            key={child.key}
            aria-label={t("family.child").replace("{n}", String(index + 1))}
            className="overflow-hidden rounded-xl border border-primary-100 bg-surface"
          >
            <div className="flex items-center justify-between gap-3 border-b border-primary-100 bg-primary-50/70 px-4 py-2">
              <h3 className="flex items-center gap-2.5 text-sm font-semibold text-primary-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-700 text-xs font-bold text-white">
                  {index + 1}
                </span>
                {t("family.child").replace("{n}", String(index + 1))}
                {(child.firstName || child.lastName) && (
                  <span className="font-normal text-foreground/55">
                    — {child.firstName} {child.lastName}
                  </span>
                )}
              </h3>
              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(child.key)}
                  title={t("family.removeChild")}
                  aria-label={`${t("family.removeChild")} ${index + 1}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 p-4 sm:grid-cols-2">
              <FormField label={t("students.firstName")} htmlFor={id("firstName")} required error={e.firstName}>
                <Input
                  id={id("firstName")}
                  value={child.firstName}
                  onChange={(ev) => onChange(child.key, { firstName: ev.target.value })}
                  placeholder={t("students.firstNamePlaceholder")}
                  autoComplete="off"
                />
              </FormField>
              <FormField label={t("students.lastName")} htmlFor={id("lastName")} required error={e.lastName}>
                <Input
                  id={id("lastName")}
                  value={child.lastName}
                  onChange={(ev) => onChange(child.key, { lastName: ev.target.value })}
                  placeholder={t("students.lastNamePlaceholder")}
                  autoComplete="off"
                />
              </FormField>
              <FormField label={t("students.dateOfBirth")} htmlFor={id("dateOfBirth")}>
                <DateInput
                  id={id("dateOfBirth")}
                  value={child.dateOfBirth}
                  onChange={(ev) => onChange(child.key, { dateOfBirth: ev.target.value })}
                />
              </FormField>
              <FormField label={t("students.gender")} htmlFor={id("gender")} required error={e.gender}>
                <GenderToggle
                  id={id("gender")}
                  value={child.gender}
                  onChange={(gender) => onChange(child.key, { gender })}
                />
              </FormField>
              <FormField
                label={t("students.class")}
                htmlFor={id("class")}
                required
                error={e.classId}
                className="sm:col-span-2"
              >
                <Select
                  value={child.classId}
                  onValueChange={(v) => {
                    // Radix renvoie parfois une valeur vide en se refermant.
                    if (v) onChange(child.key, { classId: v });
                  }}
                >
                  <SelectTrigger id={id("class")} aria-label={t("students.class")}>
                    <span className="flex min-w-0 items-center gap-2">
                      <School className="h-4 w-4 shrink-0 text-foreground/40" />
                      <SelectValue placeholder={t("students.selectClass")}>{className}</SelectValue>
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </section>
        );
      })}

      <button
        type="button"
        onClick={onAdd}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-200 text-sm font-semibold text-primary-700 transition-colors hover:border-primary-400 hover:bg-primary-50/60"
      >
        <Plus className="h-4 w-4" />
        {t("family.addChild")}
      </button>
    </div>
  );
}
