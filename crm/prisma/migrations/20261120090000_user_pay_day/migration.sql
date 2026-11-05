-- День выплаты зарплаты у сотрудника: зарплата считается за период до этого дня (null — календарный месяц, выплата в конце месяца)
ALTER TABLE "User" ADD COLUMN "payDay" INTEGER;

-- Сабина получает зарплату 20-го числа (решение владельца 05.11.2026), Диора — в конце месяца (как было)
UPDATE "User" SET "payDay" = 20 WHERE "role" = 'MANAGER' AND ("name" ILIKE '%сабин%' OR "name" ILIKE '%sabin%');
