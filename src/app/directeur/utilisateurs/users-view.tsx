"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, KeyRound, Loader2, ShieldCheck, UserCog, UserPlus, UserX, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDateIn, formatPhone } from "@/lib/format";
import { accessLabel, type DirectorAccess } from "@/lib/team";
import { CredentialsDialog } from "../comptes/credentials-dialog";
import type { AccountResult } from "../comptes/actions";
import { inviteDirector, resetDirectorPassword, setDirectorAccess, setDirectorActive } from "./actions";

export interface DirectorRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  isOwner: boolean;
  access: string;
  isActive: boolean;
  mustChangePassword: boolean;
  isSelf: boolean;
  lastAction: string | null;
}

const ACCESS_HELP: Record<DirectorAccess, string> = {
  FULL: "Fait tout ce que fait le directeur : inscriptions, paiements, annulations, suppressions…",
  READ_ONLY: "Consulte tout (élèves, familles, finances, rapports) mais ne peut rien modifier.",
};

/** Les directeurs de l'école ; le directeur principal invite et gère ses associés. */
export function UsersView({
  rows,
  canManage,
  schoolName,
  teacherAccounts,
  parentAccounts,
}: {
  rows: DirectorRow[];
  canManage: boolean;
  schoolName: string;
  teacherAccounts: number;
  parentAccounts: number;
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [credentials, setCredentials] = useState<AccountResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<DirectorRow | null>(null);

  async function run(key: string, action: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    setBusy(key);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      router.refresh();
    } catch {
      toast.error("L'opération n'a pas abouti. Vérifiez la connexion et réessayez.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5" data-testid="users-view">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <UserCog className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Utilisateurs</h1>
            <p className="text-sm text-foreground/60">
              Une école, un seul espace : tous les directeurs voient les mêmes élèves, familles et paiements.
            </p>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => setInviteOpen(true)} data-testid="invite-open">
            <UserPlus className="h-4 w-4" />
            Inviter un associé
          </Button>
        )}
      </div>

      {!canManage && (
        <p className="rounded-xl bg-surface-muted/70 px-4 py-3 text-sm text-foreground/70">
          Seul le directeur principal invite des associés et gère leurs accès.
        </p>
      )}

      <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-soft">
        {rows.map((r) => {
          const manageable = canManage && !r.isOwner && !r.isSelf;
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5" data-testid="director-row">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                  {r.name}
                  {r.isSelf && <span className="text-xs font-normal text-foreground/50">(vous)</span>}
                  <Badge variant={r.isOwner ? "success" : r.access === "READ_ONLY" ? "neutral" : "warning"} data-testid="director-role">
                    {r.isOwner ? <ShieldCheck className="me-1 inline h-3 w-3" /> : r.access === "READ_ONLY" ? <Eye className="me-1 inline h-3 w-3" /> : null}
                    {accessLabel(r)}
                  </Badge>
                  {!r.isActive && <Badge variant="danger">Accès retiré</Badge>}
                  {r.isActive && r.mustChangePassword && <Badge variant="neutral">Première connexion à faire</Badge>}
                </p>
                <p className="truncate text-xs text-foreground/55">
                  <span dir="ltr">{r.email}</span>
                  {r.phone ? (
                    <>
                      {" · "}
                      <span dir="ltr">{formatPhone(r.phone)}</span>
                    </>
                  ) : null}
                  {r.lastAction
                    ? ` · dernière action le ${formatDateIn("fr", r.lastAction, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                    : ""}
                </p>
              </div>
              {manageable && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={r.access}
                    disabled={busy !== null || !r.isActive}
                    onChange={(e) =>
                      run(
                        `access-${r.id}`,
                        () => setDirectorAccess(r.id, e.target.value as DirectorAccess),
                        `${r.name} : ${e.target.value === "READ_ONLY" ? "lecture seule" : "directeur"}.`,
                      )
                    }
                    className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
                    aria-label={`Rôle de ${r.name}`}
                    data-testid="director-access"
                  >
                    <option value="FULL">Directeur</option>
                    <option value="READ_ONLY">Lecture seule</option>
                  </select>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy !== null || !r.isActive}
                    onClick={async () => {
                      setBusy(`reset-${r.id}`);
                      try {
                        const result = await resetDirectorPassword(r.id);
                        if (!result.ok) toast.error(result.error);
                        else setCredentials(result);
                        router.refresh();
                      } finally {
                        setBusy(null);
                      }
                    }}
                    data-testid="director-reset"
                  >
                    <KeyRound className="h-4 w-4" />
                    Nouveau mot de passe
                  </Button>
                  {r.isActive ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-red-700"
                      disabled={busy !== null}
                      onClick={() => setRemoving(r)}
                      data-testid="director-remove"
                    >
                      <UserX className="h-4 w-4" />
                      Retirer l&apos;accès
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => run(`active-${r.id}`, () => setDirectorActive(r.id, true), `Accès rendu à ${r.name}.`)}
                      data-testid="director-restore"
                    >
                      <UserCheck className="h-4 w-4" />
                      Rendre l&apos;accès
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-foreground/60">
        Autres comptes de l&apos;école : {teacherAccounts} enseignant(s), {parentAccounts} parent(s) — gérés depuis{" "}
        <Link href="/directeur/enseignants" className="font-medium text-primary-700 hover:underline">
          Enseignants
        </Link>{" "}
        et{" "}
        <Link href="/directeur/parents" className="font-medium text-primary-700 hover:underline">
          Parents
        </Link>
        . Qui a fait quoi :{" "}
        <Link href="/directeur/activite" className="font-medium text-primary-700 hover:underline">
          journal d&apos;activité
        </Link>
        .
      </p>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreated={(result) => {
          setInviteOpen(false);
          setCredentials(result);
          router.refresh();
        }}
      />
      <CredentialsDialog result={credentials} onOpenChange={(open) => !open && setCredentials(null)} schoolName={schoolName} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Retirer l'accès de ${removing?.name ?? ""} ?`}
        description="La personne ne pourra plus se connecter, et sa session ouverte est coupée dès la page suivante. Son nom reste dans le journal d'activité. Vous pourrez lui rendre l'accès plus tard."
        confirmLabel="Retirer l'accès"
        variant="danger"
        loading={busy !== null}
        onConfirm={async () => {
          const target = removing;
          if (!target) return;
          await run(`active-${target.id}`, () => setDirectorActive(target.id, false), `Accès retiré à ${target.name}.`);
          setRemoving(null);
        }}
      />
    </div>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (result: AccountResult) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [access, setAccess] = useState<DirectorAccess>("FULL");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const result = await inviteDirector({ name, email, phone, access });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setName("");
      setEmail("");
      setPhone("");
      setAccess("FULL");
      onCreated(result);
    } catch {
      toast.error("L'invitation n'a pas abouti. Vérifiez la connexion et réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-md" data-testid="invite-dialog">
        <DialogHeader>
          <DialogTitle>Inviter un associé</DialogTitle>
          <DialogDescription>
            Il aura son propre identifiant (son e-mail) et choisira son mot de passe à la première connexion.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Nom complet</Label>
            <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Aminata Sow" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">E-mail (son identifiant)</Label>
            <Input
              id="invite-email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nom@exemple.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-phone">Téléphone WhatsApp (facultatif)</Label>
            <Input id="invite-phone" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="222 …" />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Rôle</legend>
            {(["FULL", "READ_ONLY"] as const).map((value) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 ${
                  access === value ? "border-primary-600 bg-primary-50" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="invite-access"
                  value={value}
                  checked={access === value}
                  onChange={() => setAccess(value)}
                  className="mt-1"
                  data-testid={`invite-access-${value}`}
                />
                <span>
                  <span className="block text-sm font-semibold">{value === "FULL" ? "Directeur" : "Lecture seule"}</span>
                  <span className="block text-xs text-foreground/60">{ACCESS_HELP[value]}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={saving || !name.trim() || !email.trim()} data-testid="invite-submit">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Créer l&apos;accès
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
