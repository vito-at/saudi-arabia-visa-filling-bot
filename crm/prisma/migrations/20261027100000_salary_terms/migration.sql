-- CreateTable
CREATE TABLE "SalaryTerm" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromMonth" DATE NOT NULL,
    "base" DECIMAL(18,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'UZS',
    "pct" DECIMAL(5,2) NOT NULL,
    "bonusPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "commissionFrom" "CommissionBase" NOT NULL DEFAULT 'REVENUE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalaryTerm_userId_fromMonth_key" ON "SalaryTerm"("userId", "fromMonth");

-- AddForeignKey
ALTER TABLE "SalaryTerm" ADD CONSTRAINT "SalaryTerm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- текущие условия менеджеров действуют «с начала» — для всех прошлых месяцев
INSERT INTO "SalaryTerm" ("id", "userId", "fromMonth", "base", "currency", "pct", "bonusPct", "commissionFrom")
SELECT 'st_' || "id", "id", DATE '2000-01-01', "salaryBase", "salaryCurrency", "commissionPct", "planBonusPct", "commissionFrom"
FROM "User" WHERE "role" = 'MANAGER';
