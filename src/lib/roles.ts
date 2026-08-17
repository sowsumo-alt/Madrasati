export const ROLES = {
  DIRECTOR: "DIRECTOR",
  TEACHER: "TEACHER",
  PARENT: "PARENT",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<string, string> = {
  DIRECTOR: "Directeur",
  TEACHER: "Enseignant",
  PARENT: "Parent",
};

export const STUDENT_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  TRANSFERRED: "TRANSFERRED",
  GRADUATED: "GRADUATED",
} as const;

export const ATTENDANCE_STATUS = {
  PRESENT: "PRESENT",
  ABSENT: "ABSENT",
  LATE: "LATE",
} as const;

export const FEE_STATUS = {
  PENDING: "PENDING",
  PAID: "PAID",
  PARTIAL: "PARTIAL",
  OVERDUE: "OVERDUE",
} as const;

export const MESSAGE_TEMPLATE_KEY = {
  PAYMENT_REMINDER: "PAYMENT_REMINDER",
  ABSENCE_ALERT: "ABSENCE_ALERT",
  GRADES_AVAILABLE: "GRADES_AVAILABLE",
  MEETING_INVITE: "MEETING_INVITE",
  CUSTOM: "CUSTOM",
} as const;
