-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onShift" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "leadLimit" INTEGER NOT NULL DEFAULT 5;

-- менеджеры, которые сейчас получают лиды, остаются «в работе» до первого выключения
UPDATE "User" SET "onShift" = true WHERE "role" = 'MANAGER' AND "isActive" = true;
