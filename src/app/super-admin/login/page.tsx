import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ShieldCheck } from "lucide-react";
import { SuperAdminLoginForm } from "./super-admin-login-form";

export default async function SuperAdminLoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role === "SUPER_ADMIN") redirect("/super-admin");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white">
            <ShieldCheck className="h-6 w-6" strokeWidth={2} />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-white">Madrasati — Super Admin</h1>
          <p className="mt-1 text-sm text-white/40">Accès réservé au propriétaire de la plateforme</p>
        </div>

        <div className="mt-6">
          <SuperAdminLoginForm />
        </div>
      </div>
    </div>
  );
}
