"use client";

import Link from "next/link";
import { UserSearch, FileText } from "lucide-react";
import { WhatsAppLink } from "@/components/ui/whatsapp-link";
import { Badge } from "@/components/ui/badge";
import { AT_RISK_CRITERIA } from "@/lib/at-risk";

export interface AtRiskRow {
  id: string;
  firstName: string;
  lastName: string;
  className: string | null;
  reasons: string[];
  parentPhone: string | null;
  message: string;
}

export function AtRiskView({
  students,
  scope,
}: {
  students: AtRiskRow[];
  /** "school" (directeur, toute l'école) ou "classes" (enseignant, ses classes seulement). */
  scope: "school" | "classes";
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Élèves à surveiller</h1>
        <p className="mt-1 text-sm text-foreground/60">
          {scope === "school"
            ? "Détecté automatiquement à partir des notes, présences et incidents disciplinaires."
            : "Élèves de vos classes détectés automatiquement à partir des notes, présences et incidents disciplinaires."}
        </p>
      </div>

      {/* La règle appliquée, écrite noir sur blanc : sans elle, le motif chiffré
          affiché sur chaque ligne ne dit pas pourquoi ce seuil-là a compté. */}
      <details className="rounded-xl border border-border bg-surface-muted/50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground/70">
          Quand un élève est-il signalé ?
        </summary>
        <ul className="mt-2 space-y-1 text-sm text-foreground/60">
          {AT_RISK_CRITERIA.map((c) => (
            <li key={c} className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
              {c}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-foreground/45">
          Un seul critère suffit à signaler l&apos;élève. Le motif exact, avec ses
          chiffres, est indiqué sur sa ligne.
        </p>
      </details>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {students.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <UserSearch className="h-5 w-5" strokeWidth={2} />
            </span>
            <p className="text-sm text-foreground/50">
              Aucun élève ne correspond aux critères de surveillance pour l&apos;instant.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="px-5 py-3">Élève</th>
                  <th className="px-5 py-3">Motif de l&apos;alerte</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-muted/40">
                    <td className="px-5 py-3 font-medium text-foreground">
                      {s.firstName} {s.lastName}
                      {s.className && (
                        <span className="ml-1.5 text-xs font-normal text-foreground/40">
                          {s.className}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {s.reasons.map((r) => (
                          <Badge key={r} variant="warning">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {s.parentPhone && (
                          <WhatsAppLink
                            phone={s.parentPhone}
                            message={s.message}
                            title="Contacter le parent sur WhatsApp"
                          />
                        )}
                        {scope === "school" && (
                          <Link
                            href={`/directeur/bulletins/${s.id}`}
                            title="Voir la fiche complète"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                          >
                            <FileText className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
