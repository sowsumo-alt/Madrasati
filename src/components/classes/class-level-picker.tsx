"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { composeClassName, type CatalogGroup } from "@/lib/class-catalog";

export interface ClassLevelValue {
  category: string;
  level: string;
  section: string;
}

export const EMPTY_CLASS_LEVEL: ClassLevelValue = { category: "", level: "", section: "" };

const chip =
  "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40";
const chipIdle = "border-border bg-surface text-foreground/75 hover:border-primary-300 hover:bg-primary-50/60";
const chipActive = "border-primary-600 bg-primary-600 text-white";

/**
 * Choix d'une classe en trois temps : la catégorie (Préscolaire, Fondamental,
 * Collège, Lycée, ou celle de l'école), puis le niveau prêt à cliquer, puis
 * une section facultative quand l'école a plusieurs classes du même niveau.
 * « Autre » permet d'ajouter une catégorie ou un niveau propre à l'école.
 */
export function ClassLevelPicker({
  catalog,
  value,
  onChange,
  showSection = true,
}: {
  catalog: CatalogGroup[];
  value: ClassLevelValue;
  onChange: (value: ClassLevelValue) => void;
  showSection?: boolean;
}) {
  const knownCategory = catalog.find((g) => g.category === value.category);
  const [customCategory, setCustomCategory] = useState(Boolean(value.category) && !knownCategory);
  const group = customCategory ? null : knownCategory ?? null;
  const knownLevel = group?.levels.includes(value.level) ?? false;
  const [customLevel, setCustomLevel] = useState(Boolean(value.level) && !knownLevel);

  const pickCategory = (category: string) => {
    setCustomCategory(false);
    setCustomLevel(false);
    onChange({ ...value, category, level: "" });
  };

  return (
    <div className="space-y-4" data-testid="class-level-picker">
      <div className="space-y-2">
        <Label>Catégorie</Label>
        <div className="flex flex-wrap gap-2">
          {catalog.map((g) => (
            <button
              key={g.category}
              type="button"
              onClick={() => pickCategory(g.category)}
              className={cn(chip, !customCategory && value.category === g.category ? chipActive : chipIdle)}
              data-testid={`category-${g.category}`}
            >
              {g.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setCustomCategory(true);
              setCustomLevel(true);
              onChange({ ...value, category: "", level: "" });
            }}
            className={cn(chip, customCategory ? chipActive : chipIdle, "inline-flex items-center gap-1")}
            data-testid="category-custom"
          >
            <Plus className="h-3.5 w-3.5" />
            Autre catégorie
          </button>
        </div>
        {customCategory && (
          <Input
            autoFocus
            value={value.category}
            onChange={(e) => onChange({ ...value, category: e.target.value })}
            placeholder="Ex. Mahadra"
            aria-label="Nom de la catégorie"
            data-testid="custom-category"
          />
        )}
      </div>

      {(group || customCategory) && (
        <div className="space-y-2">
          <Label>Niveau</Label>
          {group && (
            <div className="flex flex-wrap gap-2" data-testid="level-options">
              {group.levels.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => {
                    setCustomLevel(false);
                    onChange({ ...value, level });
                  }}
                  className={cn(chip, !customLevel && value.level === level ? chipActive : chipIdle)}
                  data-testid={`level-${level}`}
                >
                  {level}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setCustomLevel(true);
                  onChange({ ...value, level: "" });
                }}
                className={cn(chip, customLevel ? chipActive : chipIdle, "inline-flex items-center gap-1")}
                data-testid="level-custom"
              >
                <Plus className="h-3.5 w-3.5" />
                Autre niveau
              </button>
            </div>
          )}
          {customLevel && (
            <Input
              value={value.level}
              onChange={(e) => onChange({ ...value, level: e.target.value })}
              placeholder={customCategory ? "Ex. Niveau 1" : "Nom du niveau"}
              aria-label="Nom du niveau"
              data-testid="custom-level"
            />
          )}
        </div>
      )}

      {showSection && value.level.trim() && (
        <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="class-section">Section (facultatif)</Label>
            <Input
              id="class-section"
              value={value.section}
              onChange={(e) => onChange({ ...value, section: e.target.value })}
              placeholder="A, B… si plusieurs classes de ce niveau"
              data-testid="class-section"
            />
          </div>
          <p className="rounded-lg bg-primary-50/70 px-3 py-2 text-sm text-foreground/70">
            Nom de la classe :{" "}
            <strong className="text-primary-800" data-testid="class-name-preview">
              {composeClassName(value.level, value.section)}
            </strong>
          </p>
        </div>
      )}
    </div>
  );
}
