import bcrypt from "bcryptjs";
import type { LeadSource, Prisma, PrismaClient, ServiceType } from "@prisma/client";

/** Детерминированный генератор, чтобы демо-данные были одинаковыми при каждом запуске */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Азиз", "Дилноза", "Шахзод", "Мадина", "Бахтиёр", "Нигора", "Жасур", "Гулноза", "Отабек", "Феруза", "Санжар", "Малика", "Улугбек", "Зарина", "Руслан", "Камола", "Икром", "Севара", "Тимур", "Лола", "Фаррух", "Нодира", "Шерзод", "Юлдуз", "Акмал"];
const LAST = ["Каримов", "Юсупова", "Рахимов", "Абдуллаева", "Турсунов", "Назарова", "Исмоилов", "Хасанова", "Султанов", "Мирзаева", "Ахмедов", "Эргашева", "Холматов", "Раджабова", "Усмонов"];

const CAMPAIGNS = [
  { id: "120210000000001", name: "Умра 2026 — Фергана", service: "UMRAH" as ServiceType, dest: ["Мекка и Медина"], form: 1, usd: [1100, 1900] },
  { id: "120210000000002", name: "Дубай из Ферганы — осень", service: "OUTBOUND_TOUR" as ServiceType, dest: ["Дубай", "Абу-Даби"], form: 0, usd: [650, 1400] },
  { id: "120210000000003", name: "Турция всё включено", service: "OUTBOUND_TOUR" as ServiceType, dest: ["Анталья", "Стамбул", "Аланья"], form: 0, usd: [550, 1200] },
  { id: "120210000000004", name: "Медтуризм — Индия и Корея", service: "MEDICAL" as ServiceType, dest: ["Индия, Дели", "Сеул"], form: 0, usd: [1500, 3500] },
  { id: "120210000000005", name: "Авиабилеты по лучшим ценам", service: "FLIGHTS" as ServiceType, dest: ["Москва", "Санкт-Петербург", "Стамбул", "Казань"], form: 2, uzs: [2_800_000, 7_500_000] },
];
const FORMS = [
  { id: "900100000000001", name: "Заявка на тур" },
  { id: "900100000000002", name: "Умра — анкета паломника" },
  { id: "900100000000003", name: "Подбор авиабилетов" },
];
const MANUAL_SOURCES: LeadSource[] = ["CALL", "CALL", "INSTAGRAM_DIRECT", "INSTAGRAM_DIRECT", "TELEGRAM", "TELEGRAM", "WALK_IN"];

export async function seedDemo(prisma: PrismaClient, count = 100) {
  if ((await prisma.lead.count()) > 0) {
    console.log("Seed: лиды уже есть — демо-данные не добавляем");
    return;
  }
  const r = rng(20260930);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const between = (a: number, b: number) => a + r() * (b - a);
  const int = (a: number, b: number) => Math.floor(between(a, b + 1));

  // менеджеры
  const pass = await bcrypt.hash("manager123", 10);
  const managers = [];
  for (const [login, name] of [
    ["dilshod", "Дилшод Мамадалиев"],
    ["gulnora", "Гулнора Усмонова"],
    ["sardor", "Сардор Каримов"],
  ]) {
    managers.push(await prisma.user.upsert({ where: { login }, update: {}, create: { login, name, role: "MANAGER", passwordHash: pass } }));
  }
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });

  const statuses = await prisma.leadStatus.findMany({ orderBy: { order: "asc" } });
  const reasons = await prisma.lossReason.findMany({ orderBy: { order: "asc" } });
  const byKind = (k: string) => statuses.find((s) => s.kind === k)!;
  const NEW = byKind("NEW");
  const WON = byKind("WON");
  const LOST = byKind("LOST");
  const pipeline = statuses.filter((s) => s.kind !== "WON" && s.kind !== "LOST" && s.kind !== "NEW");
  const reasonWeights = [18, 10, 14, 12, 8, 4, 5, 12, 9, 3];

  await prisma.metaForm.createMany({ data: FORMS.map((f) => ({ ...f, status: "ACTIVE" })) });

  const now = Date.now();
  const DAY = 86_400_000;
  const clientsPool: { id: string; name: string; phone: string }[] = [];

  for (let i = 0; i < count; i++) {
    // время создания: последние 90 дней, чаще — недавние; последние 4 лида — совсем свежие (для подсветки)
    const ageDays = i >= count - 4 ? (count - i) * 0.012 : Math.pow(r(), 1.4) * 90;
    const createdAt = new Date(now - ageDays * DAY - int(0, 3600) * 1000);
    const isMeta = r() < 0.72;
    const camp = pick(CAMPAIGNS);
    const source: LeadSource = isMeta ? (r() < 0.55 ? "META_IG" : "META_FB") : pick(MANUAL_SOURCES);

    // повторные обращения: ~12% лидов — от существующего клиента
    let client: (typeof clientsPool)[number];
    let isRepeat = false;
    if (clientsPool.length > 10 && r() < 0.12) {
      client = pick(clientsPool);
      isRepeat = true;
    } else {
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      const phone = `+998${pick(["90", "91", "93", "94", "97", "99", "88", "33"])}${String(int(1000000, 9999999))}`;
      const c = await prisma.client.create({ data: { name, phone, createdAt } });
      client = { id: c.id, name, phone };
      clientsPool.push(client);
    }

    // итоговый статус
    const recent = ageDays < 2;
    const roll = r();
    let final = recent && roll < 0.5 ? NEW : roll < 0.22 ? WON : roll < 0.55 ? LOST : pipeline[int(0, pipeline.length - 1)] ?? NEW;
    if (i >= count - 4) final = NEW;
    const manager = final === NEW && r() < 0.6 ? null : pick(managers);

    // путь по воронке: Новый → ... → итоговый статус
    const path = [NEW];
    if (final !== NEW) {
      const depth = final === WON ? pipeline.length : final === LOST ? int(1, pipeline.length) : pipeline.indexOf(final) + 1;
      for (const s of pipeline.slice(0, depth)) path.push(s);
      if (final === WON || final === LOST) path.push(final);
      // «Не дозвонились» не всегда проходят
      const missed = path.findIndex((s) => s.name === "Не дозвонились");
      if (final === WON && missed > 0 && r() < 0.6) path.splice(missed, 1);
    }

    const firstResponseMin = final === NEW ? null : Math.round(Math.pow(r(), 2) * 180 + 2);
    let t = createdAt.getTime() + (firstResponseMin ?? 0) * 60_000;
    const history: Prisma.LeadHistoryCreateManyLeadInput[] = [
      { field: "created", userId: isMeta ? null : manager?.id ?? admin.id, newValue: isRepeat ? "повторное обращение" : null, toStatusId: NEW.id, createdAt },
    ];
    if (manager) history.push({ field: "manager", userId: null, newValue: `${manager.name} (автоматически)`, createdAt: new Date(createdAt.getTime() + 1000) });
    for (let k = 1; k < path.length; k++) {
      if (k > 1) t += between(0.1, Math.max(0.2, (ageDays * DAY) / path.length / DAY)) * DAY * 0.8;
      t = Math.min(t, now - 60_000);
      history.push({ field: "status", userId: manager?.id ?? admin.id, oldValue: path[k - 1].name, newValue: path[k].name, toStatusId: path[k].id, createdAt: new Date(t) });
    }
    const statusChangedAt = new Date(history[history.length - 1].createdAt as Date);

    let lossReasonId: string | null = null;
    if (final === LOST) {
      let x = r() * reasonWeights.reduce((a, b) => a + b, 0);
      const idx = reasonWeights.findIndex((w) => (x -= w) < 0);
      lossReasonId = reasons[Math.max(0, idx)].id;
    }

    const dest = pick(camp.dest);
    const travelers = int(1, 5);
    const tf = new Date(createdAt.getTime() + int(10, 70) * DAY);
    const form = FORMS[camp.form];
    const adsetN = int(1, 2);
    const adN = int(1, 2);
    const answers = isMeta
      ? [
          { key: "full_name", label: "Имя", value: client.name },
          { key: "phone_number", label: "Телефон", value: client.phone },
          { key: "kuda_hotite_poehat", label: "Куда хотите поехать?", value: dest },
          { key: "kogda_planiruete", label: "Когда планируете поездку?", value: pick(["В ближайший месяц", "Через 1–2 месяца", "Пока не решили"]) },
          { key: "skolko_chelovek", label: "Сколько человек поедет?", value: String(travelers) },
          ...(camp.service === "UMRAH" ? [{ key: "byl_li_ranshe", label: "Были ли раньше в Умре?", value: pick(["Да", "Нет"]) }] : []),
        ]
      : undefined;

    const comments: Prisma.CommentCreateManyLeadInput[] = [];
    if (manager && final !== NEW) {
      comments.push({ authorId: manager.id, text: pick(["Позвонил, клиент просит подобрать варианты на двоих", "Отправил подборку в WhatsApp", "Клиент сравнивает цены, перезвонить завтра", "Интересует вылет из Ферганы, не из Ташкента", "Уточнил даты, ждёт предложение"]), createdAt: new Date(createdAt.getTime() + (firstResponseMin ?? 5) * 60_000) });
    }

    const lead = await prisma.lead.create({
      data: {
        leadgenId: isMeta ? `${1700000000000000 + i * 7919}` : null,
        source,
        name: client.name,
        phone: client.phone,
        phoneRaw: client.phone,
        clientId: client.id,
        isRepeat,
        statusId: final.id,
        managerId: manager?.id ?? null,
        assignedAt: manager ? createdAt : null,
        serviceType: camp.service,
        destination: dest,
        travelFrom: r() < 0.7 ? tf : null,
        travelTo: r() < 0.7 ? new Date(tf.getTime() + int(4, 14) * DAY) : null,
        travelers,
        formAnswers: answers,
        ...(isMeta
          ? {
              formId: form.id,
              formName: form.name,
              campaignId: camp.id,
              campaignName: camp.name,
              adsetId: `${camp.id}${adsetN}`,
              adsetName: `${camp.name.split(" —")[0]} · ${adsetN === 1 ? "Фергана 25–45" : "Фергана 45+"}`,
              adId: `${camp.id}${adsetN}${adN}`,
              adName: adN === 1 ? "Видео-отзыв" : "Карусель цен",
              platform: source === "META_IG" ? "ig" : "fb",
              metaCreatedAt: createdAt,
            }
          : {}),
        lossReasonId,
        lossComment: lossReasonId && r() < 0.3 ? "Сказал, что подумает до следующего сезона" : null,
        createdAt,
        firstResponseAt: firstResponseMin !== null ? new Date(createdAt.getTime() + firstResponseMin * 60_000) : null,
        statusChangedAt,
        history: { createMany: { data: history } },
        comments: { createMany: { data: comments } },
      },
    });

    if (final === WON) {
      const deals = r() < 0.15 ? 2 : 1;
      for (let d = 0; d < deals; d++) {
        const inUsd = !("uzs" in camp);
        const amount = inUsd ? Math.round(between(camp.usd![0], camp.usd![1]) * travelers / 10) * 10 : Math.round(between(camp.uzs![0], camp.uzs![1]) * travelers / 10000) * 10000;
        const cost = Math.round(amount * between(0.78, 0.9) / (inUsd ? 10 : 10000)) * (inUsd ? 10 : 10000);
        await prisma.deal.create({
          data: {
            leadId: lead.id,
            clientId: client.id,
            managerId: manager?.id ?? managers[0].id,
            amount,
            cost,
            currency: inUsd ? "USD" : "UZS",
            paidAt: statusChangedAt,
            product: d === 0 ? `${camp.dest.length > 1 ? dest : camp.name}: ${travelers} чел.` : "Страховка и трансфер",
          },
        });
      }
    }

    // задачи: у части лидов в работе — напоминания (есть просроченные и на сегодня)
    if (manager && final !== WON && final !== LOST && r() < 0.6) {
      const offsetH = pick([-26, -3, -1, 2, 5, 30, 50]);
      await prisma.task.create({
        data: { leadId: lead.id, assigneeId: manager.id, createdById: manager.id, title: pick(["Перезвонить", "Отправить предложение", "Уточнить паспортные данные", "Напомнить об оплате"]), dueAt: new Date(now + offsetH * 3600_000) },
      });
    }
  }

  // расходы на рекламу за 90 дней (для ROI)
  const spend: Prisma.AdSpendCreateManyInput[] = [];
  for (let d = 0; d < 90; d++) {
    const date = new Date(new Date(now - d * DAY).toISOString().slice(0, 10));
    for (const c of CAMPAIGNS) {
      for (const as of [1, 2])
        for (const ad of [1, 2]) spend.push({ date, campaignId: c.id, adsetId: `${c.id}${as}`, adId: `${c.id}${as}${ad}`, spend: Math.round(between(0.8, 3.2) * 100) / 100, currency: "USD" });
    }
  }
  await prisma.adSpend.createMany({ data: spend });

  await prisma.syncLog.createMany({
    data: [
      { trigger: "CRON", startedAt: new Date(now - 10 * 60_000), finishedAt: new Date(now - 10 * 60_000 + 3200), formsChecked: 3, fetched: 2, created: 2 },
      { trigger: "MANUAL", startedAt: new Date(now - 65 * 60_000), finishedAt: new Date(now - 65 * 60_000 + 2800), formsChecked: 3, fetched: 1, created: 0, duplicates: 1 },
    ],
  });
  console.log(`Seed: создано ${count} демо-лидов, менеджеры dilshod / gulnora / sardor (пароль manager123)`);
}
