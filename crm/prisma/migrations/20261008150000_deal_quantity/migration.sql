-- Количество продаж в сделке: виза на 6 человек — 6 продаж
ALTER TABLE "Deal" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

-- Уже проданные визы: количество = число заявлений лида (если у лида одна сделка)
UPDATE "Deal" d
SET "quantity" = l."visaApplications"
FROM "Lead" l
WHERE d."leadId" = l."id"
  AND l."serviceType" = 'VISA'
  AND l."visaApplications" > 1
  AND (SELECT COUNT(*) FROM "Deal" x WHERE x."leadId" = l."id") = 1;
