-- CreateEnum
CREATE TYPE "CommissionBase" AS ENUM ('REVENUE', 'PROFIT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "commissionFrom" "CommissionBase" NOT NULL DEFAULT 'REVENUE',
ALTER COLUMN "salaryBase" SET DEFAULT 1500000,
ALTER COLUMN "commissionPct" SET DEFAULT 5;

-- условия владельца (20.10.2026): всем менеджерам 1 500 000 сум оклад + 5% от суммы продаж
UPDATE "User" SET "salaryBase" = 1500000, "salaryCurrency" = 'UZS', "commissionPct" = 5, "planBonusPct" = 0, "commissionFrom" = 'REVENUE'
WHERE "role" = 'MANAGER';
