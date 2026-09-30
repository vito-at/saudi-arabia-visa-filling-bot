import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_LOSS_REASONS, DEFAULT_STATUSES } from "../src/lib/constants";

/** Справочники и настройки по умолчанию. Идемпотентно. */
export async function seedBase(prisma: PrismaClient) {
  if ((await prisma.leadStatus.count()) === 0) {
    await prisma.leadStatus.createMany({
      data: DEFAULT_STATUSES.map((s, i) => ({ ...s, order: i + 1, isSystem: s.isSystem ?? false })),
    });
  }
  if ((await prisma.lossReason.count()) === 0) {
    await prisma.lossReason.createMany({ data: DEFAULT_LOSS_REASONS.map((name, i) => ({ name, order: i + 1 })) });
  }
  await prisma.appSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  await prisma.metaIntegration.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const login = (process.env.ADMIN_LOGIN || "admin").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const exists = await prisma.user.findUnique({ where: { login } });
  if (!exists) {
    await prisma.user.create({
      data: { login, name: "Администратор", role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) },
    });
  }
}
