import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Logo } from "@/components/brand/logo";
import { CreateSchoolForm } from "./create-school-form";

export default async function CreateSchoolPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/inscription");
  if (user.schoolId) redirect("/");

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-primary-400 px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 85% 15%, white 0, transparent 35%), radial-gradient(circle at 15% 85%, white 0, transparent 40%)",
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Logo className="h-16 w-16" />
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Presque terminé
          </h1>
          <p className="mt-2 max-w-md text-sm text-white/70">
            Connecté avec {user.email}. Il ne manque que les informations de
            votre école.
          </p>
        </div>

        <div className="mt-8 rounded-2xl bg-surface p-6 shadow-2xl sm:p-8">
          <CreateSchoolForm initialDirectorName={user.name ?? ""} />
        </div>
      </div>
    </div>
  );
}
