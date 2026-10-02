-- AlterTable
ALTER TABLE "LeadStatus" ADD COLUMN     "inFunnel" BOOLEAN NOT NULL DEFAULT true;

-- Попытки дозвона — не этапы воронки
UPDATE "LeadStatus" SET "inFunnel" = false WHERE "kind" = 'CALLBACK' OR "name" = 'Не дозвонились';
