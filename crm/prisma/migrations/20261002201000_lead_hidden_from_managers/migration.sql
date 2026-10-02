-- Лиды, созданные администратором вручную, не видны менеджерам, пока нет ответственного
ALTER TABLE "Lead" ADD COLUMN "hiddenFromManagers" BOOLEAN NOT NULL DEFAULT false;
