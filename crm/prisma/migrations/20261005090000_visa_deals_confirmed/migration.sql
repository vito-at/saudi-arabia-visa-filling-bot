-- Продажи визовой поддержки больше не ждут себестоимость: расходы на визы учитываются в расходах компании
UPDATE "Deal" SET "costConfirmed" = true
WHERE "costConfirmed" = false
  AND "leadId" IN (SELECT "id" FROM "Lead" WHERE "serviceType" = 'VISA');
