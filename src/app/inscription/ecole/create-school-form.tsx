"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Building2, Loader2, MapPin, Phone, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { completeGoogleSignup } from "./actions";
import { createSchoolSchema, type CreateSchoolValues } from "./schema";

const FIELD_CLASS =
  "h-12 w-full rounded-lg border border-border bg-surface pl-10 pr-3 text-sm text-foreground transition-colors placeholder:text-foreground/35 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500";

export function CreateSchoolForm({ initialDirectorName }: { initialDirectorName: string }) {
  const router = useRouter();
  const { update } = useSession();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateSchoolValues>({
    resolver: zodResolver(createSchoolSchema),
    defaultValues: { directorName: initialDirectorName },
  });

  async function onSubmit(values: CreateSchoolValues) {
    setServerError(null);

    const result = await completeGoogleSignup(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    // Recharge le jeton de session : role/schoolId, absents jusqu'ici,
    // deviennent disponibles sans déconnexion/reconnexion.
    await update();
    router.push("/inscription/bienvenue");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="schoolName">Nom de l&apos;école</Label>
        <div className="relative">
          <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
          <input
            id="schoolName"
            placeholder="École Al Amal"
            className={FIELD_CLASS}
            {...register("schoolName")}
          />
        </div>
        {errors.schoolName && (
          <p className="text-xs text-danger">{errors.schoolName.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="directorName">Votre nom</Label>
        <div className="relative">
          <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
          <input
            id="directorName"
            autoComplete="name"
            className={FIELD_CLASS}
            {...register("directorName")}
          />
        </div>
        {errors.directorName && (
          <p className="text-xs text-danger">{errors.directorName.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="city">Ville</Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
            <input
              id="city"
              placeholder="Nouakchott"
              className={FIELD_CLASS}
              {...register("city")}
            />
          </div>
          {errors.city && <p className="text-xs text-danger">{errors.city.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Téléphone</Label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+222 45 12 34 56"
              className={FIELD_CLASS}
              {...register("phone")}
            />
          </div>
          {errors.phone && <p className="text-xs text-danger">{errors.phone.message}</p>}
        </div>
      </div>

      {serverError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{serverError}</p>
      )}

      <Button
        type="submit"
        className="h-12 w-full bg-primary-800 text-base hover:bg-primary-900"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4.5 w-4.5" />
        )}
        Créer mon école
      </Button>
    </form>
  );
}
