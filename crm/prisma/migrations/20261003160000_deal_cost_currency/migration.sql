-- Валюта себестоимости сделки (может отличаться от валюты продажи); у существующих сделок — как у продажи
ALTER TABLE "Deal" ADD COLUMN "costCurrency" "Currency";
UPDATE "Deal" SET "costCurrency" = "currency";
ALTER TABLE "Deal" ALTER COLUMN "costCurrency" SET NOT NULL;
