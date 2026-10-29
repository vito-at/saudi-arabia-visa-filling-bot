-- Справочник виз: обновление по данным на октябрь 2026 (граждане Узбекистана и Таджикистана).
-- Главное: Таиланд с 15.09.2026 отменил безвиз для граждан Узбекистана; Турция требует визу от граждан Таджикистана;
-- Саудовская Аравия вернула e-visa; новые сборы Великобритании и США; RuID; въезд в Азербайджан только самолётом.
-- Карточки, которые сотрудники правили сами, не трогаем. Изменённые карточки снова «не проверены» — администратор сверяет заново.
UPDATE "VisaCountry" SET "validity" = 'До 180 дней в году', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'TJ' AND "code" = 'AM' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "validity" = 'До 90 дней', "notes" = 'Сухопутные границы Азербайджана закрыты для обычных путешественников с 2020 года — въезд только самолётом (поезд Тбилиси — Баку с мая 2026 — для ограниченного круга лиц). При пребывании больше 15 дней — регистрация в миграционной службе. По данным на октябрь 2026.', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'TJ' AND "code" = 'AZ' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "consularFee" = '135 £ (до 6 месяцев; с 08.04.2026) + сервисный сбор VFS Global. Долгосрочные: 2 года — 506 £, 5 лет — 903 £, 10 лет — 1 128 £', "notes" = 'Великобритания не входит в Шенген — отдельная виза. ⚠ Уточнить, где сдают биометрию граждане Таджикистана (Душанбе или Ташкент). По данным на октябрь 2026.', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'TJ' AND "code" = 'GB' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "notes" = 'С 25.05.2026 ETA бесплатна для граждан 40 стран — ⚠ проверьте на eta.gov.lk, входит ли страна в этот список; для остальных ETA платная. По данным на октябрь 2026.', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'TJ' AND "code" = 'LK' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "visaKind" = 'EVISA'::"VisaKind", "documents" = 'Загранпаспорт, действующий не меньше 6 месяцев на дату въезда
Цветное фото на белом фоне (цифровое)
Бронь отеля на все даты
Авиабилеты туда и обратно
Выписка с банковского счёта (по запросу)', "whereToApply" = 'Виза заранее: электронная виза через портал Hayya (уточнить).', "notes" = 'Безвизового режима для граждан Таджикистана нет. ⚠ Уточнить порядок и сбор на visitqatar.com. По данным на октябрь 2026.', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'TJ' AND "code" = 'QA' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "notes" = 'Перед въездом — регистрация в приложении «Госуслуги RuID» не позже чем за 72 часа (эксперимент продлён до 31.12.2027; ⚠ уточнять, обязательна ли для туристов). На границе — миграционная карта, регистрация по месту пребывания — в течение 7 рабочих дней. Для работы нужен патент. По данным на октябрь 2026.', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'TJ' AND "code" = 'RU' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "visaKind" = 'EVISA'::"VisaKind", "documents" = 'Загранпаспорт, действующий не меньше 6 месяцев на дату въезда
Цветное фото на белом фоне (цифровое)
Бронь отеля на все даты
Авиабилеты туда и обратно
Выписка с банковского счёта (по запросу)', "whereToApply" = 'Туристическая электронная виза на официальном сайте (с июня 2025 граждане Узбекистана и Таджикистана снова в списке e-visa). Умра — через лицензированных операторов (Nusuk).', "consularFee" = 'Около 535 SAR вместе с медицинской страховкой (уточнить на сайте)', "notes" = 'Заявителю — от 18 лет (младше — вместе с родителем). Во время хаджа туристическая виза не даёт права совершать хадж. По данным на октябрь 2026.', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'TJ' AND "code" = 'SA' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "documents" = 'Загранпаспорт, действующий не меньше 6 месяцев на дату въезда
Цветное фото на белом фоне (цифровое)
Бронь отеля на все даты
Авиабилеты туда и обратно
Выписка с банковского счёта (по запросу)', "validity" = 'Туристическая виза TR: до 60 дней (однократная)', "notes" = 'Таджикистана нет в списке безвизовых стран Таиланда (с 15.09.2026 безвиз — 30 дней только для 60 стран) — нужна электронная виза заранее. Перед прилётом — электронная карта прибытия TDAC. По данным на октябрь 2026.', "sources" = 'https://www.thaievisa.go.th
https://moscow.thaiembassy.org/en/publicservice/revision-of-thailand-s-visa-exemption-and-visa-on-arrival-schemes
https://tdac.immigration.go.th', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'TJ' AND "code" = 'TH' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "visaKind" = 'STICKER'::"VisaKind", "documents" = 'Анкета посольства
Загранпаспорт, действующий не меньше 6 месяцев на дату въезда
Фото 3,5×4,5
Бронь отеля и авиабилеты
Справка с работы
Выписка с банковского счёта', "validity" = NULL, "whereToApply" = 'Виза через посольство Турции в Душанбе (уточнить, доступна ли электронная виза на evisa.gov.tr).', "applyUrl" = 'https://www.evisa.gov.tr', "notes" = 'С 20.04.2024 Турция приостановила безвизовый режим для граждан Таджикистана — нужна виза. ⚠ Уточнить сроки и сбор в посольстве Турции в Душанбе. По данным на октябрь 2026.', "sources" = 'https://www.mfa.gov.tr
https://www.evisa.gov.tr', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'TJ' AND "code" = 'TR' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "consularFee" = '185 $ (B1/B2). Закон о дополнительном сборе 250 $ (visa integrity fee) принят — порядок взимания уточняйте на travel.state.gov', "notes" = 'Решение принимается на собеседовании. С 21.01.2026 Таджикистан в программе залога за визу (visa bond): при выдаче B1/B2 консул может потребовать залог 5 000–15 000 $, который возвращают после своевременного выезда. ⚠ Уточнить на travel.state.gov. По данным на октябрь 2026.', "sources" = 'https://travel.state.gov
https://tj.usembassy.gov', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'TJ' AND "code" = 'US' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "validity" = 'До 180 дней в году', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'UZ' AND "code" = 'AM' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "validity" = 'До 90 дней', "notes" = 'Сухопутные границы Азербайджана закрыты для обычных путешественников с 2020 года — въезд только самолётом (поезд Тбилиси — Баку с мая 2026 — для ограниченного круга лиц). При пребывании больше 15 дней — регистрация в миграционной службе. По данным на октябрь 2026.', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'UZ' AND "code" = 'AZ' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "notes" = 'Шенгенская виза C, до 90 дней в течение 180. Подача — не раньше чем за 6 месяцев и не позже чем за 15 дней до поездки; сдаются отпечатки пальцев. Визовый центр TLScontact переехал: Delta Tower, 2 этаж, ул. Малая кольцевая, 64А (Юнусабад), пн–пт 08:30–16:30. По данным на октябрь 2026.', "sources" = 'https://taschkent.diplo.de
https://visa.diplo.de
https://visas-de.tlscontact.com/en-us/country/uz/vac/uzTAS2de/address-opening-hours', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'UZ' AND "code" = 'DE' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "whereToApply" = 'Отдых в Шарм-эль-Шейхе и на Синае (до 15 дней) — бесплатный штамп «Sinai only» по прилёту. Для поездок в остальной Египет (Хургада, Каир) — виза заранее через посольство Египта в Ташкенте или туроператора.', "notes" = 'Более строгие правила для граждан Узбекистана (виза заранее, требования к возрасту и наличным) перенесены с 01.11.2026 на 01.03.2027. ⚠ Уточнять перед каждой продажей. По данным на октябрь 2026.', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'UZ' AND "code" = 'EG' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "appointmentUrl" = 'https://uzbek.blsspainvisa.com', "sources" = 'https://www.exteriores.gob.es
https://uzbek.blsspainvisa.com', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'UZ' AND "code" = 'ES' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "consularFee" = '135 £ (до 6 месяцев; с 08.04.2026) + сервисный сбор VFS Global. Долгосрочные: 2 года — 506 £, 5 лет — 903 £, 10 лет — 1 128 £', "notes" = 'Визовый центр VFS Global в Ташкенте работает с 05.11.2024. Великобритания не входит в Шенген — отдельная виза. По данным на октябрь 2026.', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'UZ' AND "code" = 'GB' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "whereToApply" = 'Посольство Италии в Ташкенте (ул. Юсуф Хос Хожиб, 40), лично (биометрия)', "notes" = 'Шенгенская виза C, до 90 дней в течение 180. Подача — не раньше чем за 6 месяцев и не позже чем за 15 дней до поездки; сдаются отпечатки пальцев. ⚠ Уточнить, работает ли у посольства внешний визовый центр. По данным на октябрь 2026.', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'UZ' AND "code" = 'IT' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "whereToApply" = 'Туристическую визу граждане Узбекистана подают только через аккредитованные турагентства в Ташкенте; сама виза выдаётся посольством Республики Корея.', "notes" = 'K-ETA гражданам Узбекистана недоступна — нужна виза. ⚠ Уточнить список аккредитованных агентств и сбор. По данным на октябрь 2026.', "sources" = 'https://www.visa.go.kr
https://overseas.mofa.go.kr
https://kun.uz/en/news/2026/02/03/how-citizens-of-uzbekistan-can-obtain-a-visa-to-south-korea', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'UZ' AND "code" = 'KR' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "notes" = 'С 25.05.2026 ETA бесплатна для граждан 40 стран — ⚠ проверьте на eta.gov.lk, входит ли страна в этот список; для остальных ETA платная. По данным на октябрь 2026.', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'UZ' AND "code" = 'LK' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "visaKind" = 'VISA_FREE'::"VisaKind", "validity" = 'До 30 дней', "whereToApply" = 'Виза не нужна (безвиз с октября 2023): нужен обратный билет и паспорт, действующий не меньше 6 месяцев.', "notes" = '⚠ Некоторые сайты пишут про электронную визу — перед продажей проверьте на visitqatar.com. По данным на октябрь 2026.', "sources" = 'https://visitqatar.com
https://portal.moi.gov.qa
https://kun.uz/en/news/2023/10/06/qatar-introduces-a-30-day-visa-free-regime-for-citizens-of-uzbekistan', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'UZ' AND "code" = 'QA' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "notes" = 'Перед въездом — регистрация в приложении «Госуслуги RuID» не позже чем за 72 часа (эксперимент продлён до 31.12.2027; ⚠ уточнять, обязательна ли для туристов). На границе — миграционная карта, регистрация по месту пребывания — в течение 7 рабочих дней. Для работы нужен патент. По данным на октябрь 2026.', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'UZ' AND "code" = 'RU' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "visaKind" = 'EVISA'::"VisaKind", "documents" = 'Загранпаспорт, действующий не меньше 6 месяцев на дату въезда
Цветное фото на белом фоне (цифровое)
Бронь отеля на все даты
Авиабилеты туда и обратно
Выписка с банковского счёта (по запросу)', "whereToApply" = 'Туристическая электронная виза на официальном сайте (с июня 2025 граждане Узбекистана и Таджикистана снова в списке e-visa). Умра — через лицензированных операторов (Nusuk).', "consularFee" = 'Около 535 SAR вместе с медицинской страховкой (уточнить на сайте)', "notes" = 'Заявителю — от 18 лет (младше — вместе с родителем). Во время хаджа туристическая виза не даёт права совершать хадж. По данным на октябрь 2026.', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'UZ' AND "code" = 'SA' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "visaKind" = 'EVISA'::"VisaKind", "validity" = 'Туристическая виза TR: до 60 дней (однократная)', "processingTime" = 'Около 10–14 рабочих дней (уточнить)', "consularFee" = 'Около 1 000 бат за однократную туристическую (уточнить на сайте)', "documents" = 'Загранпаспорт, действующий не меньше 6 месяцев на дату въезда
Цветное фото на белом фоне (цифровое)
Бронь отеля на все даты
Авиабилеты туда и обратно
Выписка с банковского счёта (по запросу)', "whereToApply" = 'Электронная виза Thai e-Visa на официальном сайте — оформить до поездки. Безвизовый въезд и виза по прилёту для граждан Узбекистана отменены с 15.09.2026.', "applyUrl" = 'https://www.thaievisa.go.th', "notes" = 'С 15.09.2026 Таиланд отменил для граждан Узбекистана безвизовый въезд на 60 дней и визу по прилёту — нужна виза заранее. Кто въехал до 14.09.2026 включительно, остаётся по прежнему штампу. Перед прилётом — электронная карта прибытия TDAC. По данным на октябрь 2026.', "sources" = 'https://www.thaievisa.go.th
https://moscow.thaiembassy.org/en/publicservice/revision-of-thailand-s-visa-exemption-and-visa-on-arrival-schemes
https://tdac.immigration.go.th
https://visasnews.com/en/thailand-these-21-nationalities-will-need-a-visa-starting-september-15-2026/', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'UZ' AND "code" = 'TH' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "validity" = 'До 90 дней в течение 180 дней', "notes" = 'Паспорт должен действовать не меньше 150 дней с даты въезда. Для работы и учёбы нужна виза. По данным на октябрь 2026.', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'UZ' AND "code" = 'TR' AND "updatedById" IS NULL;
UPDATE "VisaCountry" SET "consularFee" = '185 $ (B1/B2). Закон о дополнительном сборе 250 $ (visa integrity fee) принят — порядок взимания уточняйте на travel.state.gov', "notes" = 'Решение принимается на собеседовании. Узбекистан не входит в список стран с ограничениями на выдачу виз (прокламация с 01.01.2026). По данным на октябрь 2026.', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citizenship" = 'UZ' AND "code" = 'US' AND "updatedById" IS NULL;

-- шенгенские карточки: с октября 2025 на границе работает система EES (въезд-выезд с биометрией)
UPDATE "VisaCountry" SET "notes" = "notes" || ' С октября 2025 на границе Шенгена работает система EES: при первом въезде снимают отпечатки пальцев и фото.', "verifiedAt" = NULL, "verifiedById" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "notes" LIKE 'Шенгенская виза C%' AND "notes" NOT LIKE '%EES%' AND "updatedById" IS NULL;
