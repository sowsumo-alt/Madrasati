"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SuperAdminSignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/super-admin/login" })}
      className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
    >
      <LogOut className="h-3.5 w-3.5" />
      Déconnexion
    </button>
  );
}
