-- CreateEnum
CREATE TYPE "ChatChannel" AS ENUM ('INSTAGRAM', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "ChatDirection" AS ENUM ('IN', 'OUT');

-- AlterTable
ALTER TABLE "MetaIntegration" ADD COLUMN     "igAccountId" TEXT,
ADD COLUMN     "igEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "igLastEventAt" TIMESTAMP(3),
ADD COLUMN     "igUsername" TEXT;

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "channel" "ChatChannel" NOT NULL,
    "externalId" TEXT NOT NULL,
    "businessConnectionId" TEXT,
    "title" TEXT NOT NULL,
    "username" TEXT,
    "avatarUrl" TEXT,
    "leadId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageText" TEXT,
    "lastInboundAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "ChatDirection" NOT NULL,
    "text" TEXT,
    "attachments" JSONB,
    "externalId" TEXT,
    "senderId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramIntegration" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "botTokenEnc" TEXT,
    "botUsername" TEXT,
    "webhookSecret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastError" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "businessConnectionId" TEXT,
    "businessUser" TEXT,

    CONSTRAINT "TelegramIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_leadId_idx" ON "Conversation"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_channel_externalId_key" ON "Conversation"("channel", "externalId");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_conversationId_externalId_key" ON "ChatMessage"("conversationId", "externalId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

