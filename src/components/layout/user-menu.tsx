"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Avatar, nom et rôle de la personne connectée. Le menu rappelle l'école et
 * regroupe « Mon compte » et la déconnexion, qui quittent ainsi la barre
 * latérale comme sur la maquette.
 */
export function UserMenu({
  userName,
  roleLabel,
  schoolName,
}: {
  userName: string;
  roleLabel: string;
  schoolName: string;
}) {
  const { t } = useLanguage();
  const initial = userName.trim().charAt(0).toUpperCase() || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-3 rounded-xl p-1 text-start transition-colors hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:border sm:border-border sm:bg-surface sm:py-1.5 sm:pe-3 sm:ps-1.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-700 text-sm font-semibold text-white ring-2 ring-accent-200">
          {initial}
        </span>
        <span className="hidden min-w-0 flex-col leading-tight sm:flex">
          <span className="max-w-[10rem] truncate text-sm font-semibold text-foreground">
            {userName}
          </span>
          <span className="text-xs text-foreground/50">{roleLabel}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-foreground/50 sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[13rem]">
        <p className="truncate border-b border-border px-2.5 pb-2 pt-1.5 text-xs text-foreground/50">
          {schoolName}
        </p>
        <DropdownMenuItem asChild className="mt-1">
          <Link href="/mon-compte">
            <UserRound className="h-4 w-4 text-foreground/60" />
            {t("header.myAccount")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => signOut({ callbackUrl: "/login" })}
          className="text-danger"
        >
          <LogOut className="h-4 w-4" />
          {t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
