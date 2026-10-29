-- Фиксированная оплата всем менеджерам за каждую проданную единицу услуги (например, 5 $ за визу в ОАЭ) — вместо процента с этих сделок
CREATE TABLE "SalesBonus" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "country" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "fromDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesBonus_pkey" PRIMARY KEY ("id")
);

-- Решение владельца (29.10.2026): за каждую проданную визу в ОАЭ и в Сингапур менеджер получает 5 $, процент с этих продаж не начисляется
INSERT INTO "SalesBonus" ("id", "serviceType", "country", "amount", "currency", "fromDate") VALUES
  ('sb_uae_visa_20261029', 'VISA', 'ОАЭ', 5, 'USD', DATE '2026-10-29'),
  ('sb_sg_visa_20261029', 'VISA', 'Сингапур', 5, 'USD', DATE '2026-10-29');
