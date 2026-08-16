"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Lock, LogIn, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().min(1, "L'email est requis").email("Email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});
type FormValues = z.infer<typeof schema>;

export function SuperAdminLoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await signIn("super-admin", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    if (!result || result.error) {
      setServerError("Email ou mot de passe incorrect.");
      return;
    }
    router.push("/super-admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-white/70">
          Email
        </Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="h-12 w-full rounded-lg border border-white/15 bg-white/5 pl-10 pr-3 text-sm text-white transition-colors placeholder:text-white/30 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
            {...register("email")}
          />
        </div>
        {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-white/70">
          Mot de passe
        </Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="h-12 w-full rounded-lg border border-white/15 bg-white/5 pl-10 pr-3 text-sm text-white transition-colors placeholder:text-white/30 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
            {...register("password")}
          />
        </div>
        {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
      </div>

      {serverError && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {serverError}
        </p>
      )}

      <Button
        type="submit"
        className="h-12 w-full bg-white text-base text-neutral-900 hover:bg-white/90"
        disabled={isSubmitting}
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4.5 w-4.5" />}
        Se connecter
      </Button>
    </form>
  );
}
