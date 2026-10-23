-- ИИ-ассистент: последнее входящее, на которое он уже ответил или решил промолчать
ALTER TABLE "Conversation" ADD COLUMN "aiAnsweredAt" TIMESTAMP(3);
