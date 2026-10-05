-- CreateEnum
CREATE TYPE "ConversionStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "MetaIntegration" ADD COLUMN     "capiDatasetId" TEXT,
ADD COLUMN     "capiEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "capiLastError" TEXT,
ADD COLUMN     "capiLastSentAt" TIMESTAMP(3),
ADD COLUMN     "capiTestCode" TEXT,
ADD COLUMN     "capiTokenEnc" TEXT;

-- CreateTable
CREATE TABLE "ConversionEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "leadgenId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" DECIMAL(14,2),
    "status" "ConversionStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversionEvent_status_idx" ON "ConversionEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionEvent_leadId_eventName_key" ON "ConversionEvent"("leadId", "eventName");

-- AddForeignKey
ALTER TABLE "ConversionEvent" ADD CONSTRAINT "ConversionEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

