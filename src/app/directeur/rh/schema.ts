import { z } from "zod";

export const CONTRACT_TYPES = ["CDI", "CDD", "VACATAIRE"] as const;
export const LEAVE_REASONS = ["ANNUAL", "SICK", "OTHER"] as const;

export const contractSchema = z.object({
  teacherId: z.string().min(1),
  type: z.enum(CONTRACT_TYPES),
  startDate: z.string().trim().min(1, "La date de début est requise"),
  endDate: z.string().trim().optional().or(z.literal("")),
  leaveDaysPerYear: z.coerce.number().int().min(0).max(365),
  bonuses: z.array(
    z.object({
      label: z.string().trim().min(1, "Le libellé est requis"),
      amount: z.coerce.number().int().min(0),
    }),
  ),
});
export type ContractFormValues = z.infer<typeof contractSchema>;

export const leaveSchema = z.object({
  teacherId: z.string().min(1),
  startDate: z.string().trim().min(1, "La date de début est requise"),
  endDate: z.string().trim().min(1, "La date de fin est requise"),
  reason: z.enum(LEAVE_REASONS),
  note: z.string().trim().optional().or(z.literal("")),
});
export type LeaveFormValues = z.infer<typeof leaveSchema>;

export const generatePayslipSchema = z.object({
  teacherId: z.string().min(1),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  deductions: z.coerce.number().int().min(0),
  deductionNote: z.string().trim().optional().or(z.literal("")),
});
export type GeneratePayslipValues = z.infer<typeof generatePayslipSchema>;
