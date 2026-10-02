-- «Взял себе из кассы»: деньги владельца, не расход компании
ALTER TABLE "Expense" ADD COLUMN "ownerDraw" BOOLEAN NOT NULL DEFAULT false;
