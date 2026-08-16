"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { WhatsAppLink } from "@/components/ui/whatsapp-link";
import { fillTemplate, withArabic, schoolSignatureFr, schoolSignatureAr } from "@/lib/whatsapp";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import type { MentionKey } from "@/lib/report-card";

export interface BulletinRow {
  studentId: string;
  studentName: string;
  average: number | null;
  mention: MentionKey;
  rank: number | null;
  classSize: number;
  subjectsScored: number;
  parent: { firstName: string; lastName: string; phone: string } | null;
}

const MENTION_VARIANT: Record<MentionKey, BadgeProps["variant"]> = {
  EXCELLENT: "success",
  VERY_GOOD: "success",
  GOOD: "success",
  FAIRLY_GOOD: "warning",
  PASSABLE: "warning",
  INSUFFICIENT: "danger",
  NONE: "neutral",
};

/** « 3ème / 25 » en français, « 3rd / 25 » en anglais, « 3 / 25 » en arabe :
 *  les suffixes ordinaux ne se forment pas de la même façon dans les trois
 *  langues, donc l'arabe affiche simplement le nombre. */
function formatRank(
  rank: number,
  classSize: number,
  locale: string,
  t: (key: TranslationKey) => string,
) {
  if (locale === "ar") return `${rank} / ${classSize}`;
  const suffix =
    rank === 1 ? t("bulletin.rankOrdinalFirst") : t("bulletin.rankOrdinalOther");
  return `${rank}${suffix} / ${classSize}`;
}

export function BulletinsView({
  rows,
  classes,
  terms,
  selectedClassId,
  selectedTerm,
  schoolName,
  gradesTemplate,
  gradesTemplateAr,
}: {
  rows: BulletinRow[];
  classes: { id: string; name: string }[];
  terms: string[];
  selectedClassId: string;
  selectedTerm: string;
  schoolName: string;
  gradesTemplate: string;
  gradesTemplateAr?: string;
}) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const schoolFr = schoolSignatureFr(schoolName);
  const schoolAr = schoolSignatureAr(schoolName);

  function updateFilters(classId: string, term: string) {
    router.push(
      `/directeur/bulletins?classId=${classId}&term=${encodeURIComponent(term)}`,
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("bulletin.title")}</h1>
        <p className="mt-1 text-sm text-foreground/60">{t("bulletin.subtitle")}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1.5 sm:w-56">
          <Label htmlFor="bulletin-class-select">{t("bulletin.class")}</Label>
          <Select
            value={selectedClassId}
            onValueChange={(v) => updateFilters(v, selectedTerm)}
          >
            <SelectTrigger id="bulletin-class-select">
              <SelectValue placeholder={t("bulletin.chooseClass")} />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:w-56">
          <Label htmlFor="bulletin-term-select">{t("bulletin.term")}</Label>
          <Select
            value={selectedTerm}
            onValueChange={(v) => updateFilters(selectedClassId, v)}
          >
            <SelectTrigger id="bulletin-term-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {terms.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {rows.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-foreground/50">
            {classes.length === 0
              ? t("bulletin.createClassFirst")
              : t("bulletin.noActiveStudent")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="px-5 py-3">{t("finance.student")}</th>
                  <th className="px-5 py-3">{t("bulletin.overallAverage")}</th>
                  <th className="px-5 py-3">{t("bulletin.mentionLabel")}</th>
                  <th className="px-5 py-3">{t("bulletin.rank")}</th>
                  <th className="px-5 py-3 text-right">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const averageLabel = r.average != null ? r.average.toFixed(2) : "—";
                  const message = r.parent
                    ? withArabic(
                        fillTemplate(gradesTemplate, {
                          parentName: `${r.parent.firstName} ${r.parent.lastName}`,
                          studentName: r.studentName,
                          average: averageLabel,
                          schoolName: schoolFr,
                        }),
                        gradesTemplateAr &&
                          fillTemplate(gradesTemplateAr, {
                            parentName: `${r.parent.firstName} ${r.parent.lastName}`,
                            studentName: r.studentName,
                            average: averageLabel,
                            schoolName: schoolAr,
                          }),
                      )
                    : "";
                  return (
                    <tr key={r.studentId} className="hover:bg-surface-muted/40">
                      <td className="px-5 py-3 font-medium text-foreground">
                        {r.studentName}
                        {r.subjectsScored === 0 && (
                          <span className="ml-1.5 text-xs font-normal text-foreground/40">
                            {t("bulletin.noGrade")}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {r.average != null ? (
                          <span className="font-semibold text-primary-800">
                            {r.average.toFixed(2)} / 20
                          </span>
                        ) : (
                          <span className="text-foreground/30">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={MENTION_VARIANT[r.mention] ?? "neutral"}>
                          {t(`bulletin.mention.${r.mention}` as TranslationKey)}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {r.rank != null ? (
                          formatRank(r.rank, r.classSize, locale, t)
                        ) : (
                          <span className="text-foreground/30">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/directeur/bulletins/${r.studentId}?term=${encodeURIComponent(selectedTerm)}`}
                            target="_blank"
                            title={t("bulletin.viewReportCard")}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-primary-700 transition-colors hover:bg-primary-50"
                          >
                            <FileText className="h-4 w-4" />
                          </Link>
                          {r.parent && (
                            <WhatsAppLink
                              phone={r.parent.phone}
                              message={message}
                              title={t("bulletin.notifyParent")}
                              className="text-foreground/60 hover:bg-surface-muted"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
