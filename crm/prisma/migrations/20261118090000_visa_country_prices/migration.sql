-- Справочник виз: несколько цен для клиента по вариантам визы (например, на 30 дней — 40 $, на 1 год — 65 $)
ALTER TABLE "VisaCountry" ADD COLUMN "prices" JSONB NOT NULL DEFAULT '[]';

-- уже указанная цена становится первым вариантом
UPDATE "VisaCountry" SET "prices" = jsonb_build_array(jsonb_build_object('label', '', 'price', "salePrice"::float8, 'currency', "saleCurrency"::text))
WHERE "salePrice" IS NOT NULL;
