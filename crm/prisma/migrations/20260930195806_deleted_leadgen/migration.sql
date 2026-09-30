-- CreateTable
CREATE TABLE "DeletedLeadgen" (
    "leadgenId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedLeadgen_pkey" PRIMARY KEY ("leadgenId")
);
