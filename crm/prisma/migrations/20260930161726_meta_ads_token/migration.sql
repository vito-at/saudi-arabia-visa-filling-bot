-- AlterTable
ALTER TABLE "MetaIntegration" ADD COLUMN     "adsTokenEnc" TEXT,
ADD COLUMN     "initialDays" INTEGER NOT NULL DEFAULT 30;
