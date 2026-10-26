-- Особый процент менеджеру с отдельной услуги/страны (например, 9% с виз в Таиланд) вместо обычного процента
CREATE TABLE "SalaryRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "country" TEXT,
    "pct" DECIMAL(5,2) NOT NULL,
    "commissionFrom" "CommissionBase" NOT NULL DEFAULT 'REVENUE',
    "fromDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalaryRule_userId_idx" ON "SalaryRule"("userId");
ALTER TABLE "SalaryRule" ADD CONSTRAINT "SalaryRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Решение владельца: Диоре — 9% от суммы продажи виз в Таиланд с 25.10.2026 включительно (вместо обычного процента).
-- Добавляется, только если менеджер с таким именем один; иначе правило задаётся в «Отчёты → Планы и зарплата».
INSERT INTO "SalaryRule" ("id", "userId", "serviceType", "country", "pct", "commissionFrom", "fromDate")
SELECT 'salrule_diora_thai_20261025', u."id", 'VISA', 'Таиланд', 9, 'REVENUE', DATE '2026-10-25'
FROM "User" u
WHERE u."role" = 'MANAGER' AND (lower(u."name") LIKE 'diora%' OR lower(u."name") LIKE 'диора%' OR lower(u."login") LIKE 'diora%')
  AND (SELECT count(*) FROM "User" x WHERE x."role" = 'MANAGER' AND (lower(x."name") LIKE 'diora%' OR lower(x."name") LIKE 'диора%' OR lower(x."login") LIKE 'diora%')) = 1;
