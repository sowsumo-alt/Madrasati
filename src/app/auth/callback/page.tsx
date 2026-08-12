"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

/**
 * Point d'arrivée après "Continuer avec Google" (page /inscription).
 * Supabase Auth a déjà vérifié l'identité Google et redirigé ici avec une
 * session Supabase dans l'URL ; on récupère son jeton d'accès et on l'échange
 * contre une session next-auth (provider "supabase-google", voir src/lib/auth.ts).
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        if (!cancelled) setError(true);
        return;
      }

      const result = await signIn("supabase-google", {
        accessToken,
        redirect: false,
      });

      if (cancelled) return;
      if (!result || result.error) {
        setError(true);
        return;
      }

      router.push("/inscription/ecole");
      router.refresh();
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      {error ? (
        <>
          <p className="text-sm text-danger">La connexion Google a échoué.</p>
          <button
            onClick={() => router.push("/inscription")}
            className="text-sm font-medium text-primary-700 underline"
          >
            Réessayer
          </button>
        </>
      ) : (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-primary-700" />
          <p className="text-sm text-foreground/60">Connexion en cours…</p>
        </>
      )}
    </div>
  );
}
