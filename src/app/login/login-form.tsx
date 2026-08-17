"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Lock, LogIn, Mail } from "lucide-react";

const schema = z.object({
  email: z.string().min(1, "L'email est requis").email("Email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

type FormValues = z.infer<typeof schema>;

const REMEMBER_KEY = "madrasati:email";

/*
 * Les raccourcis « Se connecter en mode démonstration » ont été retirés de
 * cette page. Sur le site en production ils ouvraient l'école de démonstration
 * à n'importe quel visiteur en un clic, encombraient l'écran du directeur
 * d'une vraie école venu simplement se connecter, et surtout : le mot de passe
 * de démonstration, écrit en dur ici, partait dans le JavaScript envoyé au
 * navigateur, donc lisible par tout le monde.
 *
 * Les comptes de démonstration existent toujours en base (`npm run db:seed`) :
 * il suffit de saisir leur email et leur mot de passe dans le formulaire
 * ci-dessus pour y accéder.
 */

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const saved = window.localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setValue("email", saved);
      setRemember(true);
    }
  }, [setValue]);

  async function login(email: string, password: string) {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (!result || result.error) return false;
    router.push("/");
    router.refresh();
    return true;
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    if (remember) window.localStorage.setItem(REMEMBER_KEY, values.email);
    else window.localStorage.removeItem(REMEMBER_KEY);

    const ok = await login(values.email, values.password);
    if (!ok) setServerError("Email ou mot de passe incorrect.");
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="votre@email.com"
              className="h-12 w-full rounded-lg border border-border bg-surface pl-10 pr-3 text-sm text-foreground transition-colors placeholder:text-foreground/35 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-danger">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-12 w-full rounded-lg border border-border bg-surface pl-10 pr-11 text-sm text-foreground transition-colors placeholder:text-foreground/35 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
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

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-foreground/70">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary-700 accent-primary-700"
            />
            Se souvenir de moi
          </label>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            Mot de passe oublié ?
          </button>
        </div>

        {showHelp && (
          <p className="rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-800">
            Contactez la direction de votre école : elle peut réinitialiser
            votre mot de passe depuis son espace.
          </p>
        )}

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
            <LogIn className="h-4.5 w-4.5" />
          )}
          Se connecter
        </Button>

        <p className="text-center text-sm text-foreground/55">
          Pas encore de compte ?{" "}
          <Link
            href="/inscription"
            className="font-semibold text-primary-600 hover:underline"
          >
            Créer mon école
          </Link>
        </p>
      </form>

    </div>
  );
}
