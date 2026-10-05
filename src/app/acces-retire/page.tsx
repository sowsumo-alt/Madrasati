import { UserX } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "../compte-suspendu/sign-out-button";

/**
 * Un associé dont le directeur principal a retiré l'accès, alors que sa
 * session était encore ouverte : il ne voit plus rien de l'école.
 */
export default function AccessRemovedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <Logo className="mx-auto h-12 w-12" />
        <span className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-danger">
          <UserX className="h-6 w-6" strokeWidth={2} />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-foreground">Accès retiré</h1>
        <p className="mt-2 text-sm text-foreground/60">
          Le directeur principal de l&apos;école a retiré votre accès à Madrasati. Rapprochez-vous de lui si
          vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
