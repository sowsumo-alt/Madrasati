"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { markAsPaid } from "./actions";
import { z } from "zod";

const schema = z.object({
  amount: z.coerce.number().int().positive("Le montant doit être positif"),
  note: z.string().trim().optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

export function MarkPaidDialog({
  target,
  onOpenChange,
}: {
  target: { id: string; name: string; amountDue: number | null } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 0, note: "" },
  });

  useEffect(() => {
    if (target) reset({ amount: target.amountDue ?? 0, note: "" });
  }, [target, reset]);

  async function onSubmit(values: FormValues) {
    if (!target) return;
    try {
      await markAsPaid(target.id, values);
      toast.success("Paiement enregistré, accès réactivé.");
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marquer comme payé</DialogTitle>
          {target && <DialogDescription>{target.name}</DialogDescription>}
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="amount">Montant reçu (MRU)</Label>
            <Input id="amount" type="number" min={0} {...register("amount")} />
            {errors.amount && <p className="text-xs text-danger">{errors.amount.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">
              Note <span className="font-normal text-foreground/40">(optionnel)</span>
            </Label>
            <Input id="note" placeholder="Ex: virement Bankily" {...register("note")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer le paiement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
