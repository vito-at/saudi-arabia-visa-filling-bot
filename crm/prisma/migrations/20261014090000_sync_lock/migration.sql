-- Блокировка загрузки лидов со сроком вместо advisory-lock
ALTER TABLE "MetaIntegration" ADD COLUMN "syncLockedUntil" TIMESTAMP(3);
