-- Убираем статусы «Взят в работу» и «Отправлено предложение».
-- Лиды из них переводятся в «Консультацию» (если её нет — в первый промежуточный статус),
-- переход записывается в историю лида от имени системы.
DO $$
DECLARE target_id TEXT;
DECLARE target_name TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "LeadStatus" WHERE "name" IN ('Взят в работу', 'Отправлено предложение')) THEN
    RETURN;
  END IF;

  SELECT "id", "name" INTO target_id, target_name FROM "LeadStatus"
  WHERE "name" = 'Консультация' ORDER BY "order" LIMIT 1;
  IF target_id IS NULL THEN
    SELECT "id", "name" INTO target_id, target_name FROM "LeadStatus"
    WHERE "kind" = 'OTHER' AND "name" NOT IN ('Взят в работу', 'Отправлено предложение') ORDER BY "order" LIMIT 1;
  END IF;
  IF target_id IS NULL THEN
    SELECT "id", "name" INTO target_id, target_name FROM "LeadStatus" WHERE "kind" = 'NEW' ORDER BY "order" LIMIT 1;
  END IF;

  INSERT INTO "LeadHistory" ("id", "leadId", "userId", "field", "oldValue", "newValue", "toStatusId", "createdAt")
  SELECT 'hist_rmstatus_' || substr(md5(random()::text || l."id"), 1, 16), l."id", NULL, 'status', s."name", target_name, target_id, CURRENT_TIMESTAMP
  FROM "Lead" l JOIN "LeadStatus" s ON s."id" = l."statusId"
  WHERE s."name" IN ('Взят в работу', 'Отправлено предложение');

  UPDATE "Lead" SET "statusId" = target_id
  WHERE "statusId" IN (SELECT "id" FROM "LeadStatus" WHERE "name" IN ('Взят в работу', 'Отправлено предложение'));

  DELETE FROM "LeadStatus" WHERE "name" IN ('Взят в работу', 'Отправлено предложение');

  -- порядок без пропусков
  UPDATE "LeadStatus" s SET "order" = r.rn
  FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "order") AS rn FROM "LeadStatus") r
  WHERE s."id" = r."id";
END $$;
