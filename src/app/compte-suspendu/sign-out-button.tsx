"use client";

import { LogOut } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { signOutAndForget } from "@/lib/sign-out";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOutAndForget("/login")}
      className={buttonVariants({ variant: "secondary" })}
    >
      <LogOut className="h-4 w-4" />
      Se déconnecter
    </button>
  );
}
