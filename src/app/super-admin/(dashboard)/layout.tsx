import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { requireSuperAdmin } from "@/lib/super-admin-session";
import { SuperAdminSignOutButton } from "./sign-out-button";

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-8">
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
            <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2} />
          </span>
          <span className="font-semibold tracking-tight">Madrasati — Super Admin</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="hidden text-sm text-white/50 sm:inline">{admin.name}</span>
          <SuperAdminSignOutButton />
        </span>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}
