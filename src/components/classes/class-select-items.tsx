"use client";

import { Fragment } from "react";
import { SelectGroup, SelectItem, SelectLabel } from "@/components/ui/select";
import { isStandardCategory } from "@/lib/class-catalog";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

/**
 * Options d'une liste de classes, regroupées par catégorie dans l'ordre de la
 * scolarité : Préscolaire, Fondamental, Collège, Lycée, puis les catégories
 * propres à l'école. Les classes arrivent déjà triées (voir classOptions).
 */
export function ClassSelectItems({
  classes,
}: {
  classes: { id: string; name: string; category?: string | null }[];
}) {
  const { t } = useLanguage();
  const groups: { category: string | null; items: typeof classes }[] = [];
  for (const c of classes) {
    const category = c.category ?? null;
    const last = groups[groups.length - 1];
    if (last && last.category === category) last.items.push(c);
    else groups.push({ category, items: [c] });
  }
  const label = (category: string | null) =>
    !category
      ? t("classes.otherClasses")
      : isStandardCategory(category)
        ? t(`classes.filter.${category}` as TranslationKey)
        : category;

  return (
    <>
      {groups.map((g, i) => (
        <Fragment key={`${g.category ?? "other"}-${i}`}>
          <SelectGroup>
            <SelectLabel>{label(g.category)}</SelectLabel>
            {g.items.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </Fragment>
      ))}
    </>
  );
}
