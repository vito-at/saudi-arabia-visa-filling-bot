
-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "salaryStartAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SalaryPayout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'UZS',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalaryPayout_userId_month_idx" ON "SalaryPayout"("userId", "month");

-- AddForeignKey
ALTER TABLE "SalaryPayout" ADD CONSTRAINT "SalaryPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryPayout" ADD CONSTRAINT "SalaryPayout_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- владелец (20.10.2026): зарплату в CRM считаем по продажам начиная с этого дня (полночь по Ташкенту)
UPDATE "AppSettings" SET "salaryStartAt" = TIMESTAMP '2026-10-19 19:00:00';
