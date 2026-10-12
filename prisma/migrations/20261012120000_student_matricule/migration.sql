-- Matricule des élèves (FNC-01) : « 2026-0042 », année d'inscription et rang
-- dans l'école, unique dans l'école. Les élèves déjà inscrits reçoivent le
-- leur dans l'ordre de leur inscription ; rien d'autre n'est modifié.
-- Retour arrière :
--   DROP INDEX "students_schoolId_matricule_key";
--   ALTER TABLE "students" DROP COLUMN "matricule";

ALTER TABLE "students" ADD COLUMN "matricule" TEXT;

WITH numbered AS (
  SELECT
    "id",
    EXTRACT(YEAR FROM "enrollmentDate")::int AS "year",
    ROW_NUMBER() OVER (
      PARTITION BY "schoolId", EXTRACT(YEAR FROM "enrollmentDate")
      ORDER BY "enrollmentDate", "createdAt", "id"
    ) AS "rank"
  FROM "students"
)
UPDATE "students" AS s
SET "matricule" = numbered."year" || '-' || LPAD(numbered."rank"::text, GREATEST(4, LENGTH(numbered."rank"::text)), '0')
FROM numbered
WHERE s."id" = numbered."id";

CREATE UNIQUE INDEX "students_schoolId_matricule_key" ON "students"("schoolId", "matricule");
