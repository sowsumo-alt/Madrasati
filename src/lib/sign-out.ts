"use client";

import { signOut } from "next-auth/react";
import { clearAllDrafts } from "@/lib/form-draft";

/** Déconnexion : les brouillons de formulaires (données d'enfants) sont effacés d'abord. */
export function signOutAndForget(callbackUrl = "/login") {
  clearAllDrafts();
  return signOut({ callbackUrl });
}
