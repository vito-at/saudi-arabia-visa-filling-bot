-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "debtNote" TEXT,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DealPayment" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealPayment_dealId_idx" ON "DealPayment"("dealId");

-- AddForeignKey
ALTER TABLE "DealPayment" ADD CONSTRAINT "DealPayment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealPayment" ADD CONSTRAINT "DealPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Сделки, закрытые до учёта оплат, считаем оплаченными полностью (долгов по ним нет)
UPDATE "Deal" SET "paidAmount" = "amount";
INSERT INTO "DealPayment" ("id", "dealId", "amount", "paidAt", "userId")
SELECT 'pay_' || "id", "id", "amount", "paidAt", "managerId" FROM "Deal";
