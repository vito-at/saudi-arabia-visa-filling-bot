-- Два курса USD→UZS: продажи (выручка) и покупки (себестоимость, реклама, расходы).
-- До ближайшего обновления курса оба равны текущему.
ALTER TABLE "AppSettings" ADD COLUMN "usdRateCost" DECIMAL(12,2) NOT NULL DEFAULT 12800;
UPDATE "AppSettings" SET "usdRateCost" = "usdRate";
ALTER TABLE "AppSettings" DROP COLUMN "usdRateSide";
DROP TYPE "RateSide";

-- История курсов по дням: суммы пересчитываются по курсу дня операции.
-- Начинаем с текущего курса на сегодня; все более ранние операции считаются по нему.
CREATE TABLE "ExchangeRate" (
    "date" DATE NOT NULL,
    "sale" DECIMAL(12,2) NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("date")
);
INSERT INTO "ExchangeRate" ("date", "sale", "cost", "updatedAt")
SELECT (now() AT TIME ZONE 'Asia/Tashkent')::date, "usdRate", "usdRateCost", now() FROM "AppSettings" WHERE id = 1;
