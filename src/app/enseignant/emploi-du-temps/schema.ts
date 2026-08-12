import { z } from "zod";

export const teacherSlotSchema = z.object({
  classSubjectId: z.string().min(1, "Sélectionnez une classe et une matière"),
  dayOfWeek: z.coerce.number().int().min(1).max(5),
  startTime: z.string().trim().min(1, "L'heure de début est requise"),
  endTime: z.string().trim().min(1, "L'heure de fin est requise"),
  room: z.string().trim().optional().or(z.literal("")),
});
export type TeacherSlotFormValues = z.infer<typeof teacherSlotSchema>;

export function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
