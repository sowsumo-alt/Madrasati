"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateComment, saveComment } from "../actions";

export function CommentEditor({
  studentId,
  term,
  initialBody,
  initialBodyAr,
  isAiGenerated,
  aiEnabled,
}: {
  studentId: string;
  term: string;
  initialBody: string;
  initialBodyAr: string;
  isAiGenerated: boolean;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState(initialBody);
  const [bodyAr, setBodyAr] = useState(initialBodyAr);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const untouched = body === initialBody && bodyAr === initialBodyAr;

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const result = await generateComment(studentId, term);
      setBody(result.body);
      setBodyAr(result.bodyAr);
      toast.success("Appréciation générée. Relisez-la avant d'imprimer.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "La génération a échoué.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await saveComment(studentId, term, body, bodyAr);
      toast.success("Appréciation enregistrée.");
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-6 border-t border-border pt-6">
      <div className="no-print mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
          Appréciation
          {isAiGenerated && untouched && body && (
            <span className="ml-2 font-normal normal-case text-accent-700">
              proposée par l&apos;IA — à relire
            </span>
          )}
        </p>
        <div className="flex gap-2">
          {aiEnabled && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating || isSaving}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {body ? "Regénérer" : "Générer"}
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={isSaving || isGenerating}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Enregistrer
          </Button>
        </div>
      </div>

      {/* Saisie — masquée à l'impression */}
      <div className="no-print grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-foreground/50">Français</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Une phrase courte sur le trimestre."
            className="w-full rounded-lg border border-border bg-surface p-3 text-sm leading-relaxed text-foreground placeholder:text-foreground/40 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-foreground/50">العربية</label>
          <textarea
            value={bodyAr}
            onChange={(e) => setBodyAr(e.target.value)}
            rows={3}
            dir="rtl"
            lang="ar"
            placeholder="ملاحظة موجزة عن الفصل الدراسي."
            className="w-full rounded-lg border border-border bg-surface p-3 text-sm leading-relaxed text-foreground placeholder:text-foreground/40 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Rendu imprimé — français à gauche, arabe à droite */}
      <div className="hidden print:block">
        <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
          Appréciation / ملاحظة
        </p>
        <div className="mt-1 grid grid-cols-2 gap-6">
          <p className="text-sm leading-relaxed text-foreground">{body}</p>
          <p dir="rtl" lang="ar" className="text-sm leading-relaxed text-foreground">
            {bodyAr}
          </p>
        </div>
      </div>
    </div>
  );
}
