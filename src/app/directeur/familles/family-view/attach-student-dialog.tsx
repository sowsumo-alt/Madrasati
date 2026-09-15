"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n/language-provider";
import { attachStudentToFamily } from "../actions";
import type { AttachCandidate } from "./types";

const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Ligne d'un élève proposé, avec son bouton « Rattacher ». */
export function CandidateRow({
  candidate,
  busy,
  onAttach,
}: {
  candidate: AttachCandidate;
  busy: boolean;
  onAttach: () => void;
}) {
  const { t } = useLanguage();
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {candidate.name}
          {candidate.className && <span className="font-normal text-foreground/50"> · {candidate.className}</span>}
        </p>
        {candidate.parentName && (
          <p className="truncate text-xs text-foreground/55">
            {t("students.parent")} : {candidate.parentName}
          </p>
        )}
      </div>
      <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={onAttach}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
        {t("family.attach")}
      </Button>
    </li>
  );
}

/** Hook partagé : rattache un élève et rafraîchit la fiche. */
export function useAttach(parentId: string, onDone?: () => void) {
  const router = useRouter();
  const { t } = useLanguage();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function attach(studentId: string) {
    setBusyId(studentId);
    try {
      await attachStudentToFamily(parentId, studentId);
      toast.success(t("family.attached"));
      onDone?.();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusyId(null);
    }
  }

  return { busyId, attach };
}

/**
 * Rattache après coup un élève déjà inscrit (un frère ou une sœur inscrit
 * seul) : recherche parmi les élèves de l'école, sans rien ressaisir.
 */
export function AttachStudentDialog({
  open,
  onOpenChange,
  parentId,
  candidates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string;
  candidates: AttachCandidate[];
}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const { busyId, attach } = useAttach(parentId, () => onOpenChange(false));

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return candidates.slice(0, 8);
    return candidates
      .filter((c) => normalize(`${c.name} ${c.className ?? ""} ${c.parentName ?? ""}`).includes(q))
      .slice(0, 20);
  }, [candidates, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("family.attachStudent")}</DialogTitle>
          <DialogDescription>{t("family.attachHint")}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("family.attachSearch")}
            aria-label={t("family.attachSearch")}
            className="ps-9"
            autoFocus
          />
        </div>

        {matches.length === 0 ? (
          <p className="py-6 text-center text-sm text-foreground/50">{t("family.attachNone")}</p>
        ) : (
          <ul className="max-h-[50vh] divide-y divide-border/70 overflow-y-auto rounded-xl border border-border/70">
            {matches.map((c) => (
              <CandidateRow key={c.id} candidate={c} busy={busyId === c.id} onAttach={() => attach(c.id)} />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
