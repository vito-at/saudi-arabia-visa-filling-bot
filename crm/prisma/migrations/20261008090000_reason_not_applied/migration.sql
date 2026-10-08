-- Причина отказа «Не оставлял заявку»: человек по номеру из лид-формы говорит, что заявку не оставлял.
-- Ставим перед «Другое»; повторный запуск ничего не меняет.
INSERT INTO "LossReason" ("id", "name", "order", "isActive")
SELECT 'reason_not_applied', 'Не оставлял заявку',
       COALESCE((SELECT "order" FROM "LossReason" WHERE "name" = 'Другое' LIMIT 1), (SELECT COALESCE(MAX("order"), 0) + 1 FROM "LossReason")),
       true
WHERE NOT EXISTS (SELECT 1 FROM "LossReason" WHERE "name" = 'Не оставлял заявку');

UPDATE "LossReason"
SET "order" = (SELECT "order" FROM "LossReason" WHERE "id" = 'reason_not_applied') + 1
WHERE "name" = 'Другое'
  AND "order" <= (SELECT "order" FROM "LossReason" WHERE "id" = 'reason_not_applied');

-- Лид без ответа выделяется красным через 15 минут вместо 60 (если значение не меняли на другое)
UPDATE "AppSettings" SET "unprocessedAlertMin" = 15 WHERE "unprocessedAlertMin" = 60;
