-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "costConfirmed" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Deal_costConfirmed_idx" ON "Deal"("costConfirmed");
