"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";
import { DocumentHeader } from "@/components/documents/document-header";
import {
  OFFICIAL_HEADER_MAX_LINES,
  splitHeaderLines,
  type OfficialHeaderText,
} from "@/lib/official-header";
import { restoreDefaultOfficialHeader, updateOfficialHeader } from "./actions";

const EXAMPLE_SCHOOL = {
  name: "École Exemple",
  address: "Tevragh Zeina",
  city: "Nouakchott",
  phone: "+22222000000",
  logoUrl: null,
  logoIsLetterhead: false,
};

const textareaClass =
  "min-h-[140px] w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm leading-relaxed text-white focus:border-white/40 focus:outline-none";

export function OfficialHeaderForm({
  initial,
  isDefault,
}: {
  initial: OfficialHeaderText;
  isDefault: boolean;
}) {
  const router = useRouter();
  const [fr, setFr] = useState(initial.linesFr.join("\n"));
  const [ar, setAr] = useState(initial.linesAr.join("\n"));
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);

  const preview = { linesFr: splitHeaderLines(fr), linesAr: splitHeaderLines(ar) };
  const invalid =
    preview.linesFr.length === 0 ||
    preview.linesAr.length === 0 ||
    preview.linesFr.length > OFFICIAL_HEADER_MAX_LINES ||
    preview.linesAr.length > OFFICIAL_HEADER_MAX_LINES;

  async function save() {
    if (!confirm("Ce texte s'imprimera sur les bulletins de toutes les écoles. Confirmer ?")) return;
    setBusy("save");
    try {
      await updateOfficialHeader(preview);
      toast.success("Bloc officiel mis à jour pour toutes les écoles.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!confirm("Revenir au texte livré avec Madrasati pour toutes les écoles ?")) return;
    setBusy("reset");
    try {
      await restoreDefaultOfficialHeader();
      toast.success("Texte d'origine rétabli.");
      router.refresh();
    } catch {
      toast.error("Opération impossible.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-white/80">Français — une ligne par ligne</span>
          <textarea value={fr} onChange={(e) => setFr(e.target.value)} className={textareaClass} dir="ltr" />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-white/80">Arabe — سطر لكل سطر</span>
          <textarea value={ar} onChange={(e) => setAr(e.target.value)} className={textareaClass} dir="rtl" lang="ar" />
        </label>
      </div>
      {invalid && (
        <p className="text-sm text-amber-300">
          Chaque langue doit avoir entre 1 et {OFFICIAL_HEADER_MAX_LINES} lignes.
        </p>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45">
          Aperçu sur un bulletin
        </p>
        <div className="overflow-x-auto rounded-xl bg-white p-6">
          <div className="min-w-[560px]">
            <DocumentHeader school={EXAMPLE_SCHOOL} official={preview} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        {!isDefault && (
          <button
            type="button"
            onClick={reset}
            disabled={busy !== null}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/15 px-4 text-sm text-white/80 hover:bg-white/5 disabled:opacity-50"
          >
            {busy === "reset" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Texte d&apos;origine
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={busy !== null || invalid}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-neutral-950 hover:bg-white/90 disabled:opacity-50"
        >
          {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer pour toutes les écoles
        </button>
      </div>
    </div>
  );
}
