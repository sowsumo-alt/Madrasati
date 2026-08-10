"use client";

import { signOut } from "next-auth/react";
import { GraduationCap, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex items-center gap-2 text-primary-800">
        <GraduationCap className="h-7 w-7" strokeWidth={2} />
        <span className="text-lg font-semibold tracking-tight">
          Madrasati
        </span>
      </div>
      <h1 className="mt-6 text-xl font-semibold text-foreground">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-foreground/60">
        {description}
      </p>
      <Button
        variant="secondary"
        className="mt-6"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        <LogOut className="h-4 w-4" />
        Déconnexion
      </Button>
    </div>
  );
}
