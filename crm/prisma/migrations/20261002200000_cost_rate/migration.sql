-- Два курса USD→UZS: продажи (выручка) и покупки (себестоимость, реклама, расходы).
-- До ближайшего обновления курса оба равны текущему.
ALTER TABLE "AppSettings" ADD COLUMN "usdRateCost" DECIMAL(12,2) NOT NULL DEFAULT 12800;
UPDATE "AppSettings" SET "usdRateCost" = "usdRate";
ALTER TABLE "AppSettings" DROP COLUMN "usdRateSide";
DROP TYPE "RateSide";
