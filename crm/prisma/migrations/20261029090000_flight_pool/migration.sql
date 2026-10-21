
-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "flightPoolPct" DECIMAL(5,2) NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "serviceType" "ServiceType";

-- CreateTable
CREATE TABLE "ShiftDay" (
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,

    CONSTRAINT "ShiftDay_pkey" PRIMARY KEY ("userId","day")
);

-- AddForeignKey
ALTER TABLE "ShiftDay" ADD CONSTRAINT "ShiftDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- тип услуги прежних сделок: по названию продукта («Авиабилеты: …»), иначе — по типу услуги лида
UPDATE "Deal" SET "serviceType" = 'FLIGHTS' WHERE "product" ILIKE 'Авиабилет%';
UPDATE "Deal" SET "serviceType" = 'TOUR' WHERE "serviceType" IS NULL AND "product" ILIKE 'Тур%';
UPDATE "Deal" SET "serviceType" = 'VISA' WHERE "serviceType" IS NULL AND "product" ILIKE 'Визов%';
UPDATE "Deal" d SET "serviceType" = l."serviceType" FROM "Lead" l WHERE d."serviceType" IS NULL AND l."id" = d."leadId";

-- менеджеры, которые сейчас «В работе», работают сегодня (ташкентская дата)
INSERT INTO "ShiftDay" ("userId", "day")
SELECT "id", (now() AT TIME ZONE 'Asia/Tashkent')::date FROM "User" WHERE "role" = 'MANAGER' AND "onShift" = true
ON CONFLICT DO NOTHING;
