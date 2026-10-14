-- Сделки визовых лидов не ждут себестоимость (расходы на визы — в расходах компании),
-- даже если менеджер при закрытии выбрал в сделке другой продукт.
UPDATE "Deal" d SET "costConfirmed" = true
FROM "Lead" l
WHERE l.id = d."leadId" AND l."serviceType" = 'VISA' AND d."costConfirmed" = false;
