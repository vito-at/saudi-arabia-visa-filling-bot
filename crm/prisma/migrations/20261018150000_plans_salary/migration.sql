-- AlterTable
ALTER TABLE "User" ADD COLUMN     "commissionPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "planBonusPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "salaryBase" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "salaryCurrency" "Currency" NOT NULL DEFAULT 'UZS';

-- CreateTable
CREATE TABLE "ManagerPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "leads" INTEGER,
    "sales" INTEGER,
    "profit" DECIMAL(18,2),

    CONSTRAINT "ManagerPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagerPlan_userId_month_key" ON "ManagerPlan"("userId", "month");

-- AddForeignKey
ALTER TABLE "ManagerPlan" ADD CONSTRAINT "ManagerPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

