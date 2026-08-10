"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTemplate, saveTemplate } from "./actions";

const schema = z.object({
  title: z.string().trim().min(1, "Le titre est requis"),
  body: z.string().trim().min(1, "Le message est requis"),
});
type FormValues = z.infer<typeof schema>;

export interface TemplateEditTarget {
  id: string;
  title: string;
  body: string;
}

export function TemplateDialog({
  open,
  onOpenChange,
  editTarget,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTarget: TemplateEditTarget | null;
}) {
  const router = useRouter();
  const isEdit = Boolean(editTarget);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", body: "" },
  });

  useEffect(() => {
    if (open) {
      reset(
        editTarget
          ? { title: editTarget.title, body: editTarget.body }
          : { title: "", body: "" },
      );
    }
  }, [open, editTarget, reset]);

  async function onSubmit(values: FormValues) {
    try {
      if (isEdit && editTarget) {
        await saveTemplate(editTarget.id, values);
        toast.success("Modèle modifié.");
      } else {
        await createTemplate(values);
        toast.success("Modèle créé.");
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le modèle" : "Nouveau modèle"}</DialogTitle>
          <DialogDescription>
            Utilisez {"{parentName}"}, {"{studentName}"}, {"{schoolName}"},{" "}
            {"{date}"} — ils seront remplacés automatiquement.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="title">Titre</Label>
            <Input id="title" placeholder="Rappel de réunion" {...register("title")} />
            {errors.title && (
              <p className="text-xs text-danger">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body">Message</Label>
            <textarea
              id="body"
              rows={5}
              placeholder="Bonjour {parentName}, …"
              {...register("body")}
              className="w-full rounded-lg border border-border bg-surface p-3 text-sm leading-relaxed text-foreground placeholder:text-foreground/40 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {errors.body && <p className="text-xs text-danger">{errors.body.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
