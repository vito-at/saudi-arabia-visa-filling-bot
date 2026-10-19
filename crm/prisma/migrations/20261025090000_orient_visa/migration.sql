-- Интеграция с сайтом Orient Visa (docs/orient-visa-integration.md)
-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "orientVisaKeyEnc" TEXT,
ADD COLUMN     "orientVisaSecretEnc" TEXT,
ADD COLUMN     "orientVisaUrl" TEXT;

-- AlterTable
ALTER TABLE "LeadDocument" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "travelerName" TEXT;

-- AlterTable
ALTER TABLE "LeadService" ADD COLUMN     "agencyInn" TEXT,
ADD COLUMN     "agencyName" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "externalNumber" TEXT,
ADD COLUMN     "externalUrl" TEXT,
ADD COLUMN     "paidAmount" DECIMAL(14,2),
ADD COLUMN     "portalReference" TEXT,
ADD COLUMN     "siteDataEnc" TEXT,
ADD COLUMN     "siteFetchError" TEXT,
ADD COLUMN     "siteFetchNeeded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "siteFetchTries" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "siteFetchedAt" TIMESTAMP(3),
ADD COLUMN     "urgent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visaType" TEXT;

-- AlterTable
ALTER TABLE "VisaEvent" ADD COLUMN     "toClient" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SiteEvent" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteEvent_sentAt_nextAt_idx" ON "SiteEvent"("sentAt", "nextAt");

-- CreateIndex
CREATE INDEX "SiteEvent_serviceId_idx" ON "SiteEvent"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadService_externalId_key" ON "LeadService"("externalId");

-- AddForeignKey
ALTER TABLE "SiteEvent" ADD CONSTRAINT "SiteEvent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "LeadService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

