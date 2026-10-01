-- AlterTable
ALTER TABLE "AdSpend" ADD COLUMN     "adName" TEXT,
ADD COLUMN     "adsetName" TEXT,
ADD COLUMN     "campaignName" TEXT,
ADD COLUMN     "clicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "impressions" INTEGER NOT NULL DEFAULT 0;
