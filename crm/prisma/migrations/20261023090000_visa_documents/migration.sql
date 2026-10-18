-- CreateEnum
CREATE TYPE "VisaStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'PAID_WAITING', 'DOCS_REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApplicationSource" AS ENUM ('SALES', 'WEBSITE');

-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE 'WEBSITE';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'VISA';

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "siteApiKeyHash" TEXT;

-- CreateTable
CREATE TABLE "LeadService" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "ServiceType" NOT NULL,
    "country" TEXT,
    "note" TEXT,
    "status" "VisaStatus" NOT NULL DEFAULT 'NEW',
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "source" "ApplicationSource" NOT NULL DEFAULT 'SALES',
    "handedAt" TIMESTAMP(3),
    "assigneeId" TEXT,
    "createdById" TEXT,
    "statusAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocRequirement" (
    "id" TEXT NOT NULL,
    "type" "ServiceType" NOT NULL,
    "country" TEXT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadDocument" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "chatMessageId" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisaEvent" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "userId" TEXT,
    "status" "VisaStatus",
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisaEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadService_leadId_idx" ON "LeadService"("leadId");

-- CreateIndex
CREATE INDEX "LeadService_type_handedAt_idx" ON "LeadService"("type", "handedAt");

-- CreateIndex
CREATE INDEX "DocRequirement_type_country_idx" ON "DocRequirement"("type", "country");

-- CreateIndex
CREATE INDEX "LeadDocument_serviceId_idx" ON "LeadDocument"("serviceId");

-- CreateIndex
CREATE INDEX "LeadDocument_leadId_idx" ON "LeadDocument"("leadId");

-- CreateIndex
CREATE INDEX "VisaEvent_serviceId_createdAt_idx" ON "VisaEvent"("serviceId", "createdAt");

-- AddForeignKey
ALTER TABLE "LeadService" ADD CONSTRAINT "LeadService_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadService" ADD CONSTRAINT "LeadService_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadDocument" ADD CONSTRAINT "LeadDocument_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "LeadService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadDocument" ADD CONSTRAINT "LeadDocument_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadDocument" ADD CONSTRAINT "LeadDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaEvent" ADD CONSTRAINT "VisaEvent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "LeadService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaEvent" ADD CONSTRAINT "VisaEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

