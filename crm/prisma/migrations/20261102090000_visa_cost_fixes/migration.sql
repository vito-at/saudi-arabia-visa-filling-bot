-- Себестоимость визы в Таиланд за одно заявление ($), подставляется в визовую сделку автоматически
ALTER TABLE "AppSettings" ADD COLUMN "thaiVisaCostUsd" DECIMAL(18,2) NOT NULL DEFAULT 48;

-- Ошибка: в лиде с услугой «Виза» любая сделка (тур, «Другое») закрывалась с себестоимостью 0 и не попадала
-- в «Ждут себестоимость». Возвращаем такие сделки администратору: себестоимость нужно указать.
UPDATE "Deal" d SET "costConfirmed" = false
FROM "Lead" l
WHERE d."leadId" = l.id
  AND l."serviceType" = 'VISA'
  AND d."serviceType" IS NOT NULL
  AND d."serviceType" NOT IN ('VISA', 'FLIGHTS')
  AND d."cost" = 0
  AND d."costConfirmed" = true;
