import { z } from "zod";

export const slotSchema = z.object({
  classId: z.string().min(1, "Sélectionnez une classe"),
  classSubjectId: z.string().min(1, "Sélectionnez une matière"),
  dayOfWeek: z.coerce.number().int().min(1).max(5),
  startTime: z.string().trim().min(1, "L'heure de début est requise"),
  endTime: z.string().trim().min(1, "L'heure de fin est requise"),
  room: z.string().trim().optional().or(z.literal("")),
});
export type SlotFormValues = z.infer<typeof slotSchema>;

export function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
