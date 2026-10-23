-- Личный Telegram каждого сотрудника (Telegram Business), переписки — по аккаунту
CREATE TABLE "TelegramAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tgUserId" TEXT,
    "tgName" TEXT,
    "tgUsername" TEXT,
    "linkCode" TEXT,
    "linkCodeAt" TIMESTAMP(3),
    "connectionId" TEXT,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "canReply" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3),
    "createLeads" BOOLEAN NOT NULL DEFAULT true,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TelegramAccount_userId_key" ON "TelegramAccount"("userId");
CREATE UNIQUE INDEX "TelegramAccount_tgUserId_key" ON "TelegramAccount"("tgUserId");
CREATE UNIQUE INDEX "TelegramAccount_linkCode_key" ON "TelegramAccount"("linkCode");
CREATE UNIQUE INDEX "TelegramAccount_connectionId_key" ON "TelegramAccount"("connectionId");
ALTER TABLE "TelegramAccount" ADD CONSTRAINT "TelegramAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conversation" ADD COLUMN "accountId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "scope" TEXT NOT NULL DEFAULT '';
DROP INDEX "Conversation_channel_externalId_key";
CREATE UNIQUE INDEX "Conversation_channel_externalId_scope_key" ON "Conversation"("channel", "externalId", "scope");
CREATE INDEX "Conversation_accountId_idx" ON "Conversation"("accountId");
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TelegramAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
