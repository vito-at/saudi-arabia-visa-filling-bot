-- AlterEnum
ALTER TYPE "StatusKind" ADD VALUE 'CALLBACK';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "callbackAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "isCallback" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Lead_callbackAt_idx" ON "Lead"("callbackAt");
