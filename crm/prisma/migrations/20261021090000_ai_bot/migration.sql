-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "isAi" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "aiLockedUntil" TIMESTAMP(3),
ADD COLUMN     "aiPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiReplies" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AiBotSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "apiKeyEnc" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'OFF_HOURS',
    "channels" "ChatChannel"[] DEFAULT ARRAY['TELEGRAM', 'INSTAGRAM']::"ChatChannel"[],
    "instructions" TEXT NOT NULL DEFAULT '',
    "maxReplies" INTEGER NOT NULL DEFAULT 20,
    "lastError" TEXT,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "AiBotSettings_pkey" PRIMARY KEY ("id")
);

