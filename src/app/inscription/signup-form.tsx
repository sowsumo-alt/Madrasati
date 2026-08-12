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
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) });

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
      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl: "/inscription/ecole" })}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-border bg-surface text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted"
      >
        <GoogleIcon className="h-5 w-5" />
        Continuer avec Google
      </button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-foreground/40">
          OU CRÉER AVEC UN EMAIL
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

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

/** Logo multicolore Google, tel qu'exigé par leurs règles de marque. */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.4 0 6.4 1.2 8.8 3.5l6.6-6.6C35.3 2.5 30 0 24 0 14.6 0 6.5 5.4 2.5 13.2l7.7 6C12.1 13.1 17.5 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.6c-.5 3-2.2 5.5-4.6 7.2l7.2 5.6c4.2-3.9 6.7-9.6 6.7-17.3z"
      />
      <path
        fill="#FBBC05"
        d="M10.2 19.2c-.6 1.7-.9 3.5-.9 5.3s.3 3.6.9 5.3l-7.7 6C.9 32.6 0 28.4 0 24.5s.9-8.1 2.5-11.3z"
      />
      <path
        fill="#34A853"
        d="M24 49c6 0 11.1-2 14.8-5.4l-7.2-5.6c-2 1.4-4.6 2.2-7.6 2.2-6.5 0-12-4.3-13.9-10.2l-7.7 6C6.5 43.6 14.6 49 24 49z"
      />
    </svg>
  );
}
