-- Статус «Перезвонить» для уже работающих баз: ставим сразу после «Не дозвонились»
-- (или перед «Продано», если такого статуса нет). В новой базе статусы создаёт seed.
DO $$
DECLARE pos INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM "LeadStatus") AND NOT EXISTS (SELECT 1 FROM "LeadStatus" WHERE "kind" = 'CALLBACK') THEN
    SELECT "order" INTO pos FROM "LeadStatus" WHERE "name" = 'Не дозвонились' ORDER BY "order" LIMIT 1;
    IF pos IS NULL THEN
      SELECT COALESCE(MAX("order"), 0) INTO pos FROM "LeadStatus" WHERE "kind" NOT IN ('WON', 'LOST');
    END IF;
    UPDATE "LeadStatus" SET "order" = "order" + 1 WHERE "order" > pos;
    INSERT INTO "LeadStatus" ("id", "name", "color", "order", "kind", "isSystem")
    VALUES ('status_callback_' || substr(md5(random()::text), 1, 12), 'Перезвонить', '#fa6500', pos + 1, 'CALLBACK', true);
  END IF;
END $$;
