-- Решение владельца (14.11.2026): за каждую проданную визу в Бахрейн менеджер получает 5 $, процент с этих продаж не начисляется
INSERT INTO "SalesBonus" ("id", "serviceType", "country", "amount", "currency", "fromDate") VALUES
  ('sb_bh_visa_20261114', 'VISA', 'Бахрейн', 5, 'USD', DATE '2026-11-14')
ON CONFLICT ("id") DO NOTHING;
