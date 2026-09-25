"use client";

import { Check, ChevronDown, Users, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Choix d'une ou de plusieurs classes — ou matières —, présenté comme une
 * liste déroulante (la maquette n'en montre qu'une) mais qui garde la
 * planification d'un même examen pour plusieurs en une fois. Le menu reste
 * ouvert tant qu'on coche.
 */
export function ClassMultiSelect({
  id,
  classes,
  value,
  onChange,
  placeholder,
  selectAllLabel,
  clearLabel,
  emptyLabel,
  countLabel,
  icon: Icon = Users,
  disabled = false,
}: {
  id: string;
  classes: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  selectAllLabel: string;
  clearLabel: string;
  emptyLabel: string;
  /** Libellé au-delà de deux choix, avec {n}. */
  countLabel: string;
  icon?: LucideIcon;
  disabled?: boolean;
}) {
  const selectedNames = classes.filter((c) => value.includes(c.id)).map((c) => c.name);
  const label =
    selectedNames.length === 0
      ? placeholder
      : selectedNames.length <= 2
        ? selectedNames.join(", ")
        : countLabel.replace("{n}", String(selectedNames.length));
  const allSelected = classes.length > 0 && value.length === classes.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id={id}
        disabled={disabled}
        className="flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 text-start text-sm text-foreground focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon className="h-4 w-4 shrink-0 text-foreground/40" />
        <span className={cn("min-w-0 flex-1 truncate", selectedNames.length === 0 && "text-foreground/40")}>
          {label}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-foreground/40" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
      >
        {classes.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-foreground/50">{emptyLabel}</p>
        ) : (
          <>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onChange(allSelected ? [] : classes.map((c) => c.id));
              }}
              className="font-medium text-primary-700"
            >
              {allSelected ? clearLabel : selectAllLabel}
            </DropdownMenuItem>
            {classes.map((c) => {
              const checked = value.includes(c.id);
              return (
                <DropdownMenuItem
                  key={c.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    onChange(checked ? value.filter((v) => v !== c.id) : [...value, c.id]);
                  }}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      checked ? "border-primary-700 bg-primary-700 text-white" : "border-border",
                    )}
                  >
                    {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  {c.name}
                </DropdownMenuItem>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
