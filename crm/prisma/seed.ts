import { PrismaClient } from "@prisma/client";
import { seedBase } from "./seed-base";

const prisma = new PrismaClient();

async function main() {
  await seedBase(prisma);
  console.log("Seed: справочники и администратор созданы");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
