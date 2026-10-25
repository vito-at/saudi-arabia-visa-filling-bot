-- «В работе» снова есть: последнее действие менеджера в CRM (через час без действий «В работе» выключается само)
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
-- сколько секунд за день менеджер был «В работе» и что-то делал в CRM (меньше 4 часов — без доли с авиабилетов)
ALTER TABLE "ShiftDay" ADD COLUMN "activeSec" INTEGER NOT NULL DEFAULT 0;
-- переключатель не показывался с 23.10.2026: старые отметки сбрасываем, каждый включает «В работе» сам
UPDATE "User" SET "onShift" = false;
