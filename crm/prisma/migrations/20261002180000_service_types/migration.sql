-- Типы услуг: «Выездной тур» и «Въездной тур» объединены в «Тур»; умра и медицинский туризм убраны (лиды переходят в «Другое»)
ALTER TYPE "ServiceType" RENAME TO "ServiceType_old";
CREATE TYPE "ServiceType" AS ENUM ('FLIGHTS', 'TOUR', 'VISA', 'OTHER');
ALTER TABLE "Lead" ALTER COLUMN "serviceType" TYPE "ServiceType" USING (
  CASE "serviceType"::text
    WHEN 'OUTBOUND_TOUR' THEN 'TOUR'
    WHEN 'INBOUND_TOUR' THEN 'TOUR'
    WHEN 'UMRAH' THEN 'OTHER'
    WHEN 'MEDICAL' THEN 'OTHER'
    ELSE "serviceType"::text
  END
)::"ServiceType";
DROP TYPE "ServiceType_old";
