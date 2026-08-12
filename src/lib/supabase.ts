import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Client Supabase Auth, utilisé uniquement pour la connexion "Continuer
 * avec Google" (page /inscription). Le reste de l'appli (données métier)
 * passe par Prisma, pas par ce client. Sûr à utiliser côté navigateur : la
 * clé anon/publishable est publique par design.
 */
export function createSupabaseBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

/** Même client, côté serveur — sert uniquement à vérifier un token d'accès reçu du navigateur. */
export function createSupabaseServerClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}
