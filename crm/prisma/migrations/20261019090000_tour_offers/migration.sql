-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "offersToken" TEXT;

-- CreateTable
CREATE TABLE "TourOffer" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "hotel" TEXT NOT NULL,
    "stars" INTEGER,
    "destination" TEXT,
    "meal" TEXT,
    "dateFrom" DATE,
    "nights" INTEGER,
    "adults" INTEGER,
    "children" INTEGER,
    "operator" TEXT,
    "priceOperator" DECIMAL(18,2) NOT NULL,
    "markup" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "photoUrl" TEXT,
    "link" TEXT,
    "note" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TourOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TourOffer_leadId_idx" ON "TourOffer"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_offersToken_key" ON "Lead"("offersToken");

-- AddForeignKey
ALTER TABLE "TourOffer" ADD CONSTRAINT "TourOffer_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

