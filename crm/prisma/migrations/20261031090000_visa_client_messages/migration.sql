
-- AlterTable
ALTER TABLE "VisaEvent" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "fromClient" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "VisaEvent_externalId_key" ON "VisaEvent"("externalId");

