"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  UserRound,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  SCHOOL_TYPES,
  SCHOOL_TYPE_LABELS,
  SCHOOL_TYPE_HINTS,
  describeSchoolType,
} from "@/lib/school-levels";
import { registerSchool } from "./actions";
import { signupSchema, type SignupValues } from "./schema";

const FIELD_CLASS =
  "h-12 w-full rounded-lg border border-border bg-surface pl-10 pr-3 text-sm text-foreground transition-colors placeholder:text-foreground/35 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500";

export function SignupForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { schoolType: "complet" },
  });
  const schoolType = watch("schoolType");

  async function onSubmit(values: SignupValues) {
    setServerError(null);

    const result = await registerSchool(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    const signedIn = await signIn("credentials", {
      email: values.email.trim().toLowerCase(),
      password: values.password,
      redirect: false,
    });

    if (!signedIn || signedIn.error) {
      // L'école existe, seule la connexion automatique a échoué.
      router.push("/login");
      return;
    }

    router.push("/inscription/bienvenue");
    router.refresh();
  }

  return (
    <div className="space-y-6">
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

      {/* Ce choix suffit à créer toutes les classes de l'école : le directeur
          n'a rien à saisir, il retrouve ses niveaux dès sa première connexion. */}
      <div className="space-y-1.5">
        <Label>Niveaux enseignés</Label>
        <div className="grid grid-cols-3 gap-2">
          {SCHOOL_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() =>
                setValue("schoolType", type, { shouldValidate: true })
              }
              aria-pressed={schoolType === type}
              className={cn(
                "rounded-lg border px-2 py-3 text-center transition-colors",
                schoolType === type
                  ? "border-primary-500 bg-primary-50 text-primary-800 ring-1 ring-primary-500"
                  : "border-border text-foreground/70 hover:border-primary-300 hover:bg-surface-muted",
              )}
            >
              <span className="block text-xs font-medium leading-tight">
                {SCHOOL_TYPE_LABELS[type]}
              </span>
              <span className="mt-0.5 block text-[11px] text-foreground/45">
                {SCHOOL_TYPE_HINTS[type]}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-foreground/50">
          {describeSchoolType(schoolType)} seront créées automatiquement, avec
          leurs matières. Vous pourrez les modifier ensuite.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="directorName">Votre nom</Label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
            <input
              id="directorName"
              autoComplete="name"
              placeholder="Mohamed Ould Ahmed"
              className={FIELD_CLASS}
              {...register("directorName")}
            />
          </div>
          {errors.directorName && (
            <p className="text-xs text-danger">{errors.directorName.message}</p>
          )}
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
          {errors.phone && (
            <p className="text-xs text-danger">{errors.phone.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email de connexion</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="directeur@monecole.mr"
            className={FIELD_CLASS}
            {...register("email")}
          />
        </div>
        {errors.email && (
          <p className="text-xs text-danger">{errors.email.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              className={`${FIELD_CLASS} pr-11`}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword
                  ? "Masquer le mot de passe"
                  : "Afficher le mot de passe"
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 transition-colors hover:text-foreground/70"
            >
              {showPassword ? (
                <EyeOff className="h-4.5 w-4.5" />
              ) : (
                <Eye className="h-4.5 w-4.5" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-danger">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirmer</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
            <input
              id="confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              className={FIELD_CLASS}
              {...register("confirm")}
            />
          </div>
          {errors.confirm && (
            <p className="text-xs text-danger">{errors.confirm.message}</p>
          )}
        </div>
      </div>

      {serverError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
          {serverError}
        </p>
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

      <p className="text-center text-xs text-foreground/45">
        Essai libre, sans carte bancaire. Vos données restent les vôtres.
      </p>
    </form>
    </div>
  );
}
