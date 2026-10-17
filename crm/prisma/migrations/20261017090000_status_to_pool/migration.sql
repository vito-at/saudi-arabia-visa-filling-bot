-- «Не дозвонились»: лид уходит в общий список, следующий менеджер, сменивший статус, становится ответственным
ALTER TABLE "LeadStatus" ADD COLUMN "toPool" BOOLEAN NOT NULL DEFAULT false;
UPDATE "LeadStatus" SET "toPool" = true WHERE "name" = 'Не дозвонились' AND "kind" IN ('OTHER', 'IN_PROGRESS');

-- лиды, которые уже стоят в «Не дозвонились», тоже переходят в общий список (с записью в историю)
INSERT INTO "LeadHistory" ("id", "leadId", "userId", "field", "oldValue", "newValue", "createdAt")
SELECT 'pool_' || l.id, l.id, NULL, 'manager', u.name, 'общий список', now()
FROM "Lead" l
JOIN "LeadStatus" s ON s.id = l."statusId" AND s."toPool"
LEFT JOIN "User" u ON u.id = l."managerId"
WHERE l."managerId" IS NOT NULL;
UPDATE "Lead" l SET "managerId" = NULL, "assignedAt" = NULL, "hiddenFromManagers" = false
FROM "LeadStatus" s
WHERE s.id = l."statusId" AND s."toPool" AND (l."managerId" IS NOT NULL OR l."hiddenFromManagers");
