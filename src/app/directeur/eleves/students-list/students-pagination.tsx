"use client";

import { ListPagination } from "@/components/ui/list-pagination";
import { useLanguage } from "@/lib/i18n/language-provider";

/** « Affichage de 1 à 10 sur 28 élèves » et les numéros de page. */
export function StudentsPagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useLanguage();
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <ListPagination
      page={page}
      pageCount={pageCount}
      summary={t("students.showing")
        .replace("{from}", String(from))
        .replace("{to}", String(to))
        .replace("{total}", String(total))}
      previousLabel={t("students.previousPage")}
      nextLabel={t("students.nextPage")}
      onPageChange={onPageChange}
    />
  );
}
