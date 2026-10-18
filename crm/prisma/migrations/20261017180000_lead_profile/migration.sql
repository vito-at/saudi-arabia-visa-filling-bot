-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT');

-- CreateEnum
CREATE TYPE "QuestionRole" AS ENUM ('DEPART_DATE', 'RETURN_DATE');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "profile" JSONB,
ADD COLUMN     "tripFollowUpAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LeadQuestion" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'TEXT',
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "role" "QuestionRole",
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LeadQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadQuestion_role_key" ON "LeadQuestion"("role");


-- Вопросы анкеты по умолчанию (администратор меняет их в «Настройки → Анкета клиента»)
INSERT INTO "LeadQuestion" ("id", "label", "type", "options", "role", "order") VALUES
  ('q_with',     'С кем едет?',                                'SELECT', ARRAY['Один', 'Пара', 'Семья с детьми', 'Друзья', 'Коллеги'], NULL, 1),
  ('q_adults',   'Сколько взрослых?',                          'NUMBER', ARRAY[]::TEXT[], NULL, 2),
  ('q_children', 'Дети и их возраст',                          'TEXT',   ARRAY[]::TEXT[], NULL, 3),
  ('q_depart',   'Дата вылета',                                'DATE',   ARRAY[]::TEXT[], 'DEPART_DATE', 4),
  ('q_return',   'Дата возвращения',                           'DATE',   ARRAY[]::TEXT[], 'RETURN_DATE', 5),
  ('q_nights',   'Сколько ночей?',                             'TEXT',   ARRAY[]::TEXT[], NULL, 6),
  ('q_budget',   'Бюджет',                                     'TEXT',   ARRAY[]::TEXT[], NULL, 7),
  ('q_wishes',   'Пожелания: отель, питание, город вылета',    'TEXT',   ARRAY[]::TEXT[], NULL, 8);
