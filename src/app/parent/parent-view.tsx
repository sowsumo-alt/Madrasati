"use client";

import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  Wallet,
  Award,
  MessageCircle,
  Phone,
  Check,
  X,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMRU, formatDate } from "@/lib/format";
import { buildWhatsAppUrl, buildTelUrl } from "@/lib/whatsapp";

export interface ChildData {
  id: string;
  firstName: string;
  lastName: string;
  className: string | null;
  attendanceRate: number;
  attendanceHistory: { date: string; status: string }[];
  fees: {
    id: string;
    label: string;
    amount: number;
    dueDate: string;
    status: string;
    totalPaid: number;
  }[];
  reportCard: {
    lines: {
      subject: string;
      coefficient: number;
      average: number | null;
      classAverage: number | null;
    }[];
    overallAverage: number | null;
    mention: string;
    rank: number | null;
    classSize: number;
    comment: string | null;
    commentAr: string | null;
  } | null;
  schedule: {
    id: string;
    dayOfWeek: number;
    startMinutes: number;
    endMinutes: number;
    room: string | null;
    subject: string;
    teacher: string | null;
  }[];
}

const DAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
];

const STATUS_META: Record<string, { label: string; icon: typeof Check; className: string }> = {
  PRESENT: { label: "Présent", icon: Check, className: "text-success" },
  ABSENT: { label: "Absent", icon: X, className: "text-danger" },
  LATE: { label: "Retard", icon: Clock, className: "text-warning" },
};

const FEE_STATUS: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  PENDING: { label: "En attente", variant: "neutral" },
  PARTIAL: { label: "Partiel", variant: "warning" },
  PAID: { label: "Payé", variant: "success" },
  OVERDUE: { label: "Impayé", variant: "danger" },
};

function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function ParentView({
  parentName,
  childList,
  selectedChildId,
  selectedTerm,
  terms,
  data,
  schoolName,
  schoolPhone,
}: {
  parentName: string;
  /** Nommé childList et non children : « children » est réservé par React. */
  childList: { id: string; name: string }[];
  selectedChildId: string;
  selectedTerm: string;
  terms: string[];
  data: ChildData;
  schoolName: string;
  schoolPhone: string | null;
}) {
  const router = useRouter();

  function navigate(childId: string, term: string) {
    router.push(`/parent?childId=${childId}&term=${encodeURIComponent(term)}`);
  }

  const unpaid = data.fees.reduce(
    (sum, f) => sum + Math.max(f.amount - f.totalPaid, 0),
    0,
  );

  const contactMessage = `Bonjour, je suis ${parentName}, parent de ${data.firstName} ${data.lastName}.`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {data.firstName} {data.lastName}
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            {data.className ?? "Sans classe"} · {schoolName}
          </p>
        </div>
        <div className="flex gap-2">
          {schoolPhone && (
            <>
              <a
                href={buildWhatsAppUrl(schoolPhone, contactMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-800"
              >
                <MessageCircle className="h-4 w-4" />
                Contacter l&apos;école
              </a>
              <a
                href={buildTelUrl(schoolPhone)}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                <Phone className="h-4 w-4" />
                Appeler
              </a>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {childList.length > 1 && (
          <div className="sm:max-w-xs sm:flex-1">
            <Select
              value={selectedChildId}
              onValueChange={(v) => navigate(v, selectedTerm)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {childList.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="sm:max-w-xs sm:flex-1">
          <Select
            value={selectedTerm}
            onValueChange={(v) => navigate(selectedChildId, v)}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Moyenne générale"
          value={
            data.reportCard?.overallAverage != null
              ? `${data.reportCard.overallAverage.toFixed(2)} / 20`
              : "—"
          }
          icon={Award}
          tone="primary"
        />
        <StatTile
          label="Taux de présence"
          value={`${data.attendanceRate} %`}
          icon={ClipboardCheck}
          tone="primary"
        />
        <StatTile
          label="Reste à payer"
          value={formatMRU(unpaid)}
          icon={Wallet}
          tone={unpaid > 0 ? "warning" : "primary"}
        />
      </div>

      {/* — Bulletin */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Bulletin — {selectedTerm}
            {data.reportCard?.rank && (
              <span className="ml-2 font-normal text-foreground/50">
                {data.reportCard.rank}
                <sup>e</sup> sur {data.reportCard.classSize}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!data.reportCard || data.reportCard.lines.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-foreground/40">
              Aucune note pour ce trimestre.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                      <th className="px-5 py-3">Matière</th>
                      <th className="px-5 py-3">Coef.</th>
                      <th className="px-5 py-3">Moyenne</th>
                      <th className="px-5 py-3">Moy. classe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.reportCard.lines.map((l) => (
                      <tr key={l.subject}>
                        <td className="px-5 py-2.5 font-medium text-foreground">
                          {l.subject}
                        </td>
                        <td
                          className="px-5 py-2.5 text-foreground/60"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {l.coefficient}
                        </td>
                        <td
                          className="px-5 py-2.5 font-medium text-foreground"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {l.average != null ? l.average.toFixed(2) : "—"}
                        </td>
                        <td
                          className="px-5 py-2.5 text-foreground/60"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {l.classAverage != null ? l.classAverage.toFixed(2) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-border px-5 py-4">
                <span className="text-sm font-semibold text-foreground">
                  Moyenne générale
                </span>
                <span className="flex items-center gap-3">
                  <Badge variant="success">{data.reportCard.mention}</Badge>
                  <span className="text-lg font-semibold text-primary-800">
                    {data.reportCard.overallAverage != null
                      ? `${data.reportCard.overallAverage.toFixed(2)} / 20`
                      : "—"}
                  </span>
                </span>
              </div>

              {(data.reportCard.comment || data.reportCard.commentAr) && (
                <div className="border-t border-border px-5 py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
                    Appréciation / ملاحظة
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <p className="text-sm leading-relaxed text-foreground">
                      {data.reportCard.comment}
                    </p>
                    <p
                      dir="rtl"
                      lang="ar"
                      className="text-sm leading-relaxed text-foreground"
                    >
                      {data.reportCard.commentAr}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* — Paiements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Frais de scolarité</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.fees.length === 0 ? (
              <p className="px-5 py-10 text-center text-xs text-foreground/40">
                Aucun frais enregistré.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {data.fees.map((f) => {
                  const status =
                    f.status !== "PAID" && new Date(f.dueDate) < new Date()
                      ? "OVERDUE"
                      : f.status;
                  const meta = FEE_STATUS[status] ?? FEE_STATUS.PENDING;
                  return (
                    <li key={f.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{f.label}</p>
                        <p className="text-xs text-foreground/50">
                          Échéance {formatDate(f.dueDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className="text-sm font-medium text-foreground"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {formatMRU(f.amount)}
                        </p>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* — Présences récentes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Présences récentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.attendanceHistory.length === 0 ? (
              <p className="px-5 py-10 text-center text-xs text-foreground/40">
                Aucun appel enregistré pour l&apos;instant.
              </p>
            ) : (
              <ul className="max-h-72 divide-y divide-border overflow-y-auto">
                {data.attendanceHistory.map((a) => {
                  const meta = STATUS_META[a.status] ?? STATUS_META.PRESENT;
                  const Icon = meta.icon;
                  return (
                    <li
                      key={a.date}
                      className="flex items-center justify-between px-5 py-2.5"
                    >
                      <span className="text-sm text-foreground/70">
                        {formatDate(a.date)}
                      </span>
                      <span
                        className={`flex items-center gap-1.5 text-xs font-medium ${meta.className}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* — Emploi du temps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Emploi du temps</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {data.schedule.length === 0 ? (
            <p className="py-8 text-center text-xs text-foreground/40">
              L&apos;emploi du temps n&apos;est pas encore publié.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {DAYS.map((day) => {
                const daySlots = data.schedule.filter((s) => s.dayOfWeek === day.value);
                return (
                  <div key={day.value} className="rounded-lg border border-border p-2.5">
                    <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-foreground/50">
                      {day.label}
                    </p>
                    {daySlots.length === 0 ? (
                      <p className="py-4 text-center text-xs text-foreground/30">—</p>
                    ) : (
                      <div className="space-y-1.5">
                        {daySlots.map((s) => (
                          <div key={s.id} className="rounded bg-primary-50 px-2 py-1.5">
                            <p className="text-xs font-medium text-primary-800">
                              {minutesToTime(s.startMinutes)} – {minutesToTime(s.endMinutes)}
                            </p>
                            <p className="text-xs text-foreground">{s.subject}</p>
                            {s.teacher && (
                              <p className="text-xs text-foreground/50">{s.teacher}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
