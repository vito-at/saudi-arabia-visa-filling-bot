-- Решение владельца (27.10.2026): Диоре вернуть прежний процент с виз в Таиланд — особое правило 9% убираем,
-- эти сделки снова считаются по её обычным условиям зарплаты. Сама возможность особых процентов остаётся.
DELETE FROM "SalaryRule" r
USING "User" u
WHERE r."userId" = u."id"
  AND r."serviceType" = 'VISA' AND r."country" = 'Таиланд' AND r."pct" = 9
  AND (lower(u."name") LIKE 'diora%' OR lower(u."name") LIKE 'диора%' OR lower(u."login") LIKE 'diora%');
