"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ImagePicker } from "@/components/ui/image-picker";
import { formatDate } from "@/lib/format";
import type { Plan } from "@/lib/plans";
import {
  updateSchool,
  createAcademicYear,
  setCurrentYear,
  type SchoolFormValues,
} from "./actions";
import { PlanCard } from "./plan-card";

const schoolSchema = z.object({
  name: z.string().trim().min(1, "Le nom de l'école est requis"),
  address: z.string().trim().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().optional().or(z.literal("")),
  logoUrl: z.string().nullable().optional(),
});

const yearSchema = z.object({
  label: z.string().trim().min(1, "Le libellé est requis"),
  startDate: z.string().trim().min(1, "La date de début est requise"),
  endDate: z.string().trim().min(1, "La date de fin est requise"),
});
type YearValues = z.infer<typeof yearSchema>;

export interface YearRow {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export function SettingsView({
  school,
  years,
  counts,
  plan,
  trialDaysLeft,
}: {
  school: SchoolFormValues;
  years: YearRow[];
  counts: { students: number; teachers: number; classes: number };
  plan: Plan;
  trialDaysLeft: number | null;
}) {
  const router = useRouter();
  const [yearDialogOpen, setYearDialogOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const schoolForm = useForm<SchoolFormValues>({
    resolver: zodResolver(schoolSchema),
    defaultValues: school,
  });
  const logoUrl = schoolForm.watch("logoUrl") ?? null;

  const yearForm = useForm<YearValues>({
    resolver: zodResolver(yearSchema),
    defaultValues: { label: "", startDate: "", endDate: "" },
  });

  async function onSaveSchool(values: SchoolFormValues) {
    try {
      await updateSchool(values);
      toast.success("Informations de l'école enregistrées.");
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue.");
    }
  }

  async function onCreateYear(values: YearValues) {
    try {
      await createAcademicYear(values);
      toast.success("Année scolaire ajoutée.");
      setYearDialogOpen(false);
      yearForm.reset({ label: "", startDate: "", endDate: "" });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  async function handleSetCurrent(yearId: string) {
    setSwitchingId(yearId);
    try {
      await setCurrentYear(yearId);
      toast.success("Année scolaire active mise à jour.");
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setSwitchingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Paramètres</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Informations de votre école et années scolaires.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Informations de l&apos;école</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <form
            onSubmit={schoolForm.handleSubmit(onSaveSchool)}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-1.5">
              <Label>Logo de l&apos;école</Label>
              <ImagePicker
                value={logoUrl}
                onChange={(v) =>
                  schoolForm.setValue("logoUrl", v, { shouldDirty: true })
                }
                maxSize={320}
                label="Choisir un logo"
              />
              <p className="text-xs text-foreground/40">
                Il apparaîtra en haut des bulletins et des reçus.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nom de l&apos;école</Label>
                <Input id="name" {...schoolForm.register("name")} />
                {schoolForm.formState.errors.name && (
                  <p className="text-xs text-danger">
                    {schoolForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  placeholder="+222 XX XX XX XX"
                  {...schoolForm.register("phone")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  placeholder="Nouakchott, Mauritanie"
                  {...schoolForm.register("address")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...schoolForm.register("email")} />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={schoolForm.formState.isSubmitting}>
                {schoolForm.formState.isSubmitting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Enregistrer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <PlanCard
        currentPlan={plan}
        schoolName={school.name}
        studentCount={counts.students}
        trialDaysLeft={trialDaysLeft}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Années scolaires</CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setYearDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouvelle année
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="px-5 py-3">Année</th>
                  <th className="px-5 py-3">Début</th>
                  <th className="px-5 py-3">Fin</th>
                  <th className="px-5 py-3 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {years.map((y) => (
                  <tr key={y.id} className="hover:bg-surface-muted/40">
                    <td className="px-5 py-3 font-medium text-foreground">{y.label}</td>
                    <td className="px-5 py-3 text-foreground/70">
                      {formatDate(y.startDate)}
                    </td>
                    <td className="px-5 py-3 text-foreground/70">
                      {formatDate(y.endDate)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {y.isCurrent ? (
                        <Badge variant="success">
                          <Check className="mr-1 inline h-3 w-3" />
                          Année active
                        </Badge>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={switchingId === y.id}
                          onClick={() => handleSetCurrent(y.id)}
                        >
                          {switchingId === y.id && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          Rendre active
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Votre école en chiffres</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-3 gap-2 text-center sm:gap-4">
            <div>
              <p className="text-2xl font-semibold text-foreground">{counts.students}</p>
              <p className="text-xs text-foreground/50">Élèves</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{counts.teachers}</p>
              <p className="text-xs text-foreground/50">Enseignants</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{counts.classes}</p>
              <p className="text-xs text-foreground/50">Classes</p>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-foreground/40">
            Monnaie : Ouguiya mauritanien (MRU)
          </p>
        </CardContent>
      </Card>

      <Dialog open={yearDialogOpen} onOpenChange={setYearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle année scolaire</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={yearForm.handleSubmit(onCreateYear)}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="label">Libellé</Label>
              <Input id="label" placeholder="2026-2027" {...yearForm.register("label")} />
              {yearForm.formState.errors.label && (
                <p className="text-xs text-danger">
                  {yearForm.formState.errors.label.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Début</Label>
                <Input id="startDate" type="date" {...yearForm.register("startDate")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">Fin</Label>
                <Input id="endDate" type="date" {...yearForm.register("endDate")} />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setYearDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={yearForm.formState.isSubmitting}>
                {yearForm.formState.isSubmitting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Ajouter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
