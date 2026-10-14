-- Тип услуги лидов, проданных до появления списка «Продукт» в окне сделки: по названию продукта сделки.
-- Сначала точные подписи списка (RU/UZ/EN), затем слова — в том же порядке, что guessService (авиа → виза → тур).
WITH guess AS (
  SELECT DISTINCT ON (d."leadId") d."leadId",
    CASE
      WHEN d.product ~* '^(Авиабилеты|Aviachiptalar|Flights)(:|$)' THEN 'FLIGHTS'
      WHEN d.product ~* '^(Визовая поддержка|Viza ko.magi|Visa support)(:|$)' THEN 'VISA'
      WHEN d.product ~* '^(Тур|Tur|Tour)(:|$)' THEN 'TOUR'
      WHEN d.product ~* '^(Другое|Boshqa|Other)(:|$)' THEN 'OTHER'
      WHEN d.product ~* '(авиа|билет|avia|chipta|flight|ticket)' THEN 'FLIGHTS'
      WHEN d.product ~* '(виз|viza|visa)' THEN 'VISA'
      WHEN d.product ~* '(тур|tour|sayohat|отдых)' THEN 'TOUR'
    END AS service
  FROM "Deal" d
  JOIN "Lead" l ON l.id = d."leadId" AND l."serviceType" IS NULL
  ORDER BY d."leadId", d."paidAt" ASC
)
UPDATE "Lead" l SET "serviceType" = guess.service::"ServiceType"
FROM guess
WHERE l.id = guess."leadId" AND guess.service IS NOT NULL;
