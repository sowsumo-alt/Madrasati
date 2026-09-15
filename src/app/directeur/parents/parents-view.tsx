"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Pencil,
  Phone,
  KeyRound,
  Loader2,
  Lock,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createParentAccount,
  resetUserPassword,
  type AccountResult,
} from "@/app/directeur/comptes/actions";
import { CredentialsDialog } from "@/app/directeur/comptes/credentials-dialog";
import { WhatsAppLink } from "@/components/ui/whatsapp-link";
import {
  ParentFormDialog,
  type ParentEditTarget,
  type ParentStudentOption,
} from "./parent-form-dialog";
import { buildTelUrl } from "@/lib/whatsapp";
import { useLanguage } from "@/lib/i18n/language-provider";
import { familyLabel, type FamilyBalance } from "@/lib/family";
import { formatMRU } from "@/lib/format";

export interface ParentRow {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  address: string | null;
  relationship: string | null;
  /** Nom de la famille, s'il a été saisi (sinon « Famille » + nom). */
  familyName: string | null;
  children: { id: string; name: string; className: string | null }[];
  /** Situation financière de la famille, tous enfants confondus. */
  balance: FamilyBalance;
  /** Identifiant du compte de connexion, s'il en a un. */
  userId: string | null;
  accountEmail: string | null;
}

export function ParentsView({
  parents,
  students,
  schoolName,
  parentPortalEnabled,
}: {
  parents: ParentRow[];
  students: ParentStudentOption[];
  schoolName: string;
  parentPortalEnabled: boolean;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ParentEditTarget | null>(null);
  const [credentials, setCredentials] = useState<AccountResult | null>(null);
  const [accountBusyId, setAccountBusyId] = useState<string | null>(null);

  async function handleAccount(p: ParentRow) {
    setAccountBusyId(p.id);
    try {
      setCredentials(
        p.userId
          ? await resetUserPassword(p.userId)
          : await createParentAccount(p.id),
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setAccountBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parents;
    return parents.filter(
      (p) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        p.children.some((c) => c.name.toLowerCase().includes(q)),
    );
  }, [parents, query]);

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(p: ParentRow) {
    setEditTarget({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      phone: p.phone,
      email: p.email,
      address: p.address,
      relationship: p.relationship,
      studentIds: p.children.map((c) => c.id),
    });
    setFormOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Parents</h1>
          <p className="mt-1 text-sm text-foreground/60">{t("parents.subtitle")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouveau parent
        </Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("parents.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-foreground/50">
            {parents.length === 0
              ? "Aucun parent pour l'instant. Ajoutez le premier."
              : "Aucun parent ne correspond à votre recherche."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="px-5 py-3">Nom</th>
                  <th className="px-5 py-3">{t("parents.phone")}</th>
                  <th className="px-5 py-3">Enfant(s)</th>
                  <th className="px-5 py-3">{t("family.colBalance")}</th>
                  <th className="px-5 py-3">{t("parents.access")}</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => {
                  const waMessage = `Bonjour ${p.firstName}, ici ${schoolName}.`;
                  return (
                    <tr key={p.id} className="hover:bg-surface-muted/40">
                      <td className="px-5 py-3 font-medium text-foreground">
                        {p.firstName} {p.lastName}
                        {p.relationship && (
                          <span className="ml-1.5 text-xs font-normal text-foreground/40">
                            ({p.relationship})
                          </span>
                        )}
                        {p.children.length > 0 && (
                          <Link
                            href={`/directeur/familles/${p.id}`}
                            className="mt-0.5 flex w-fit items-center gap-1 text-xs font-semibold text-violet-700 hover:underline"
                          >
                            <Users className="h-3 w-3" />
                            {familyLabel(p, t("family.defaultName"))}
                          </Link>
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">{p.phone}</td>
                      <td className="px-5 py-3 text-foreground/70">
                        {p.children.length === 0 ? (
                          <span className="text-foreground/40">{t("parents.noChild")}</span>
                        ) : (
                          <ul className="space-y-1">
                            {p.children.map((c) => (
                              <li key={c.id} className="flex items-center gap-2">
                                <span className="truncate">{c.name}</span>
                                {c.className && (
                                  <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">
                                    {c.className}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {p.balance.billed === 0 ? (
                          <span className="text-foreground/40">{t("family.noFees")}</span>
                        ) : (
                          <>
                            <span className="block text-foreground/60">
                              {t("family.paid")} : <span className="font-semibold text-emerald-700">{formatMRU(p.balance.paid)}</span>
                            </span>
                            <span className={p.balance.due > 0 ? "font-semibold text-amber-700" : "font-semibold text-foreground/45"}>
                              {p.balance.due > 0
                                ? t("family.dueAmount").replace("{amount}", formatMRU(p.balance.due))
                                : t("family.upToDate")}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {p.userId ? (
                          <span className="text-xs text-foreground/60">
                            {p.accountEmail}
                          </span>
                        ) : parentPortalEnabled ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={accountBusyId === p.id}
                            onClick={() => handleAccount(p)}
                          >
                            {accountBusyId === p.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <KeyRound className="h-3 w-3" />
                            )}
                            Créer un accès
                          </Button>
                        ) : (
                          <Link
                            href="/directeur/fonctionnalite-verrouillee?feature=parentPortal"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-muted px-2.5 py-1.5 text-xs font-medium text-foreground/50 hover:text-foreground"
                          >
                            <Lock className="h-3 w-3" />{t("parents.advancedPlan")}</Link>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <WhatsAppLink
                            phone={p.phone}
                            message={waMessage}
                            title={t("parents.contactWhatsapp")}
                          />
                          <a
                            href={buildTelUrl(p.phone)}
                            title="Appeler"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                          {p.userId && (
                            <button
                              onClick={() => handleAccount(p)}
                              disabled={accountBusyId === p.id}
                              title={t("parents.resetPassword")}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted disabled:opacity-50"
                            >
                              {accountBusyId === p.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <KeyRound className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          {p.children.length > 0 && (
                            <Link
                              href={`/directeur/familles/${p.id}`}
                              title={t("family.open")}
                              aria-label={t("family.open")}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-violet-700 transition-colors hover:bg-violet-50"
                            >
                              <Users className="h-4 w-4" />
                            </Link>
                          )}
                          <button
                            onClick={() => openEdit(p)}
                            title="Modifier"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
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

      <ParentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        students={students}
        editTarget={editTarget}
      />
      <CredentialsDialog
        result={credentials}
        onOpenChange={(open) => !open && setCredentials(null)}
        schoolName={schoolName}
      />
    </div>
  );
}
