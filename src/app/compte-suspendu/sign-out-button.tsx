"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={buttonVariants({ variant: "secondary" })}
    >
      <LogOut className="h-4 w-4" />
      Se déconnecter
    </button>
  );
}
