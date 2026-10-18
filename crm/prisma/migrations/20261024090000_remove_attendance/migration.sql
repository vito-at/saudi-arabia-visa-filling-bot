-- Посещаемость убрана по решению владельца
-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_userId_fkey";

-- DropIndex
DROP INDEX "User_telegramId_key";

-- DropIndex
DROP INDEX "User_telegramLinkCode_key";

-- AlterTable
ALTER TABLE "AppSettings" DROP COLUMN "attendanceEnabled",
DROP COLUMN "attendanceGeo",
DROP COLUMN "attendanceGraceMin",
DROP COLUMN "attendanceReportDay",
DROP COLUMN "lateFine",
DROP COLUMN "officeLat",
DROP COLUMN "officeLng",
DROP COLUMN "officeRadiusM";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "telegramId",
DROP COLUMN "telegramLinkCode",
DROP COLUMN "telegramLinkUntil",
DROP COLUMN "telegramName";

-- DropTable
DROP TABLE "Attendance";

