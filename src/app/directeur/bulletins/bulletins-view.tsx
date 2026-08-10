"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, MessageCircle } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { buildWhatsAppUrl, fillTemplate } from "@/lib/whatsapp";

export interface BulletinRow {
  studentId: string;
  studentName: string;
  average: number | null;
  mention: string;
  rank: number | null;
  classSize: number;
  subjectsScored: number;
  parent: { firstName: string; lastName: string; phone: string } | null;
}

const MENTION_VARIANT: Record<string, BadgeProps["variant"]> = {
  Excellent: "success",
  "Très bien": "success",
  Bien: "success",
  "Assez bien": "warning",
  Passable: "warning",
  Insuffisant: "danger",
  "—": "neutral",
};

export function BulletinsView({
  rows,
  classes,
  terms,
  selectedClassId,
  selectedTerm,
  schoolName,
  gradesTemplate,
}: {
  rows: BulletinRow[];
  classes: { id: string; name: string }[];
  terms: string[];
  selectedClassId: string;
  selectedTerm: string;
  schoolName: string;
  gradesTemplate: string;
}) {
  const router = useRouter();

  function updateFilters(classId: string, term: string) {
    router.push(
      `/directeur/bulletins?classId=${classId}&term=${encodeURIComponent(term)}`,
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Bulletins</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Moyennes pondérées par coefficient, mention et classement, générés
          automatiquement à partir des notes saisies.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1.5 sm:w-56">
          <Label>Classe</Label>
          <Select
            value={selectedClassId}
            onValueChange={(v) => updateFilters(v, selectedTerm)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir une classe" />
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
          <Label>Trimestre</Label>
          <Select
            value={selectedTerm}
            onValueChange={(v) => updateFilters(selectedClassId, v)}
          >
            <SelectTrigger>
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
              ? "Créez d'abord une classe."
              : "Aucun élève actif dans cette classe."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="px-5 py-3">Élève</th>
                  <th className="px-5 py-3">Moyenne générale</th>
                  <th className="px-5 py-3">Mention</th>
                  <th className="px-5 py-3">Rang</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const message = r.parent
                    ? fillTemplate(gradesTemplate, {
                        parentName: `${r.parent.firstName} ${r.parent.lastName}`,
                        studentName: r.studentName,
                        schoolName,
                      })
                    : "";
                  return (
                    <tr key={r.studentId} className="hover:bg-surface-muted/40">
                      <td className="px-5 py-3 font-medium text-foreground">
                        {r.studentName}
                        {r.subjectsScored === 0 && (
                          <span className="ml-1.5 text-xs font-normal text-foreground/40">
                            aucune note
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
                          {r.mention}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {r.rank != null ? (
                          `${r.rank}${r.rank === 1 ? "er" : "ème"} / ${r.classSize}`
                        ) : (
                          <span className="text-foreground/30">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/directeur/bulletins/${r.studentId}?term=${encodeURIComponent(selectedTerm)}`}
                            target="_blank"
                            title="Voir le bulletin"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-primary-700 transition-colors hover:bg-primary-50"
                          >
                            <FileText className="h-4 w-4" />
                          </Link>
                          {r.parent && (
                            <a
                              href={buildWhatsAppUrl(r.parent.phone, message)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Prévenir le parent sur WhatsApp"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
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
