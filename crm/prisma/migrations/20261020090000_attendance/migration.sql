-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "attendanceEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "attendanceGeo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "attendanceGraceMin" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "attendanceReportDay" DATE,
ADD COLUMN     "lateFine" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "officeLat" DOUBLE PRECISION,
ADD COLUMN     "officeLng" DOUBLE PRECISION,
ADD COLUMN     "officeRadiusM" INTEGER NOT NULL DEFAULT 200;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "telegramId" TEXT,
ADD COLUMN     "telegramLinkCode" TEXT,
ADD COLUMN     "telegramLinkUntil" TIMESTAMP(3),
ADD COLUMN     "telegramName" TEXT;

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "lateMin" INTEGER NOT NULL DEFAULT 0,
    "fine" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "inLat" DOUBLE PRECISION,
    "inLng" DOUBLE PRECISION,
    "outLat" DOUBLE PRECISION,
    "outLng" DOUBLE PRECISION,
    "note" TEXT,
    "editedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attendance_day_idx" ON "Attendance"("day");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_userId_day_key" ON "Attendance"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramLinkCode_key" ON "User"("telegramLinkCode");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

