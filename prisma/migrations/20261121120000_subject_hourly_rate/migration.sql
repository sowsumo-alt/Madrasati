-- Pointage : prix de l'heure par matière (Physique 1 300 MRU/h, Maths 200 MRU/h…).
-- Ajouts seulement : aucune colonne ni donnée existante n'est modifiée ou supprimée.
-- La seule écriture remplit la matière des séances déjà générées, d'après leur
-- créneau d'emploi du temps.

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "hourlyRate" INTEGER;

-- AlterTable
ALTER TABLE "teaching_sessions" ADD COLUMN     "subjectId" TEXT;

-- AddForeignKey
ALTER TABLE "teaching_sessions" ADD CONSTRAINT "teaching_sessions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Séances déjà générées : leur matière, d'après le créneau.
UPDATE "teaching_sessions" AS ts
SET "subjectId" = cs."subjectId"
FROM "schedule_slots" AS ss
JOIN "class_subjects" AS cs ON cs."id" = ss."classSubjectId"
WHERE ts."scheduleSlotId" = ss."id" AND ts."subjectId" IS NULL;
