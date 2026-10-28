-- Справочник стран для виз: документы, сборы, цена продажи, где и как подавать
CREATE TYPE "VisaKind" AS ENUM ('EVISA', 'STICKER', 'ON_ARRIVAL', 'VISA_FREE');

CREATE TABLE "VisaCountry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visaKind" "VisaKind",
    "documents" TEXT NOT NULL DEFAULT '',
    "consularFee" TEXT,
    "salePrice" DECIMAL(18,2),
    "saleCurrency" "Currency" NOT NULL DEFAULT 'USD',
    "processingTime" TEXT,
    "validity" TEXT,
    "whereToApply" TEXT,
    "applyUrl" TEXT,
    "appointmentUrl" TEXT,
    "visaCenter" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    CONSTRAINT "VisaCountry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VisaCountry_name_key" ON "VisaCountry"("name");
ALTER TABLE "VisaCountry" ADD CONSTRAINT "VisaCountry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- страны, с которыми CRM уже работает (список в карточке сделки) — пустые карточки, данные заполняют сотрудники
INSERT INTO "VisaCountry" ("id", "name", "updatedAt") VALUES
  ('vc_singapore', 'Сингапур', CURRENT_TIMESTAMP),
  ('vc_thailand', 'Таиланд', CURRENT_TIMESTAMP),
  ('vc_vietnam', 'Вьетнам', CURRENT_TIMESTAMP),
  ('vc_saudi', 'Саудовская Аравия', CURRENT_TIMESTAMP),
  ('vc_kyrgyzstan', 'Кыргызстан', CURRENT_TIMESTAMP);
