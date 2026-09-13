import type { BadgeProps } from "@/components/ui/badge";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

export const STUDENT_STATUSES = ["ACTIVE", "INACTIVE", "TRANSFERRED", "GRADUATED"] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const STATUS_KEYS: Record<string, TranslationKey> = {
  ACTIVE: "students.status.ACTIVE",
  INACTIVE: "students.status.INACTIVE",
  TRANSFERRED: "students.status.TRANSFERRED",
  GRADUATED: "students.status.GRADUATED",
};

export const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  TRANSFERRED: "warning",
  GRADUATED: "warning",
};
