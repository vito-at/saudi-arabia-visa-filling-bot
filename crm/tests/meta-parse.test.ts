import { describe, expect, it } from "vitest";
import { guessService, nameFromAnswers, parseAnswerDate, parseMetaLead, parseMetaTime, phoneFromAnswers, tripFromAnswers, type MetaLead } from "@/lib/meta/parse";

const base: MetaLead = {
  id: "1234567890123456",
  created_time: "2026-09-30T05:12:44+0000",
  ad_id: "23850000000000011",
  ad_name: "Видео-отзыв",
  adset_id: "2385000000000001",
  adset_name: "Фергана 25–45",
  campaign_id: "238500000000000",
  campaign_name: "Дубай из Ферганы — осень",
  form_id: "900100000000001",
  platform: "ig",
  field_data: [],
};

describe("parseMetaLead", () => {
  it("разбирает стандартные поля и кастомные вопросы", () => {
    const r = parseMetaLead(
      {
        ...base,
        field_data: [
          { name: "full_name", values: ["Азиз Каримов"] },
          { name: "phone_number", values: ["+998901234567"] },
          { name: "email", values: ["Aziz@Mail.ru"] },
          { name: "куда_хотите_поехать?", values: ["Дубай"] },
          { name: "сколько_человек_поедет?", values: ["3_человека"] },
          { name: "когда_планируете_поездку?", values: ["через_1-2_месяца"] },
        ],
      },
      { formName: "Заявка на тур" },
    );
    expect(r.name).toBe("Азиз Каримов");
    expect(r.phone).toBe("+998901234567");
    expect(r.email).toBe("aziz@mail.ru");
    expect(r.source).toBe("META_IG");
    expect(r.destination).toBe("Дубай");
    expect(r.travelers).toBe(3);
    expect(r.travelFrom).toBeNull(); // «через 1-2 месяца» — не дата
    expect(r.leadgenId).toBe(base.id);
    expect(r.campaignName).toBe("Дубай из Ферганы — осень");
    expect(r.adsetName).toBe("Фергана 25–45");
    expect(r.adName).toBe("Видео-отзыв");
    expect(r.formName).toBe("Заявка на тур");
    expect(r.metaCreatedAt?.toISOString()).toBe("2026-09-30T05:12:44.000Z");
    const answers = r.formAnswers as unknown as { key: string; label: string; value: string }[];
    expect(answers).toHaveLength(3);
    expect(answers[2]).toEqual({ key: "когда_планируете_поездку?", label: "Когда планируете поездку?", value: "через 1-2 месяца" });
    expect(r.serviceType).toBe("TOUR");
  });

  it("использует подписи вопросов из формы и собирает имя из first/last name", () => {
    const r = parseMetaLead(
      {
        ...base,
        platform: "fb",
        field_data: [
          { name: "first_name", values: ["Мадина"] },
          { name: "last_name", values: ["Юсупова"] },
          { name: "phone_number", values: ["90 123 45 67"] },
          { name: "q1", values: ["Мекка и Медина"] },
          { name: "q2", values: ["2026-11-15"] },
          { name: "q3", values: ["5"] },
        ],
      },
      { labels: { q1: "Направление", q2: "Дата вылета", q3: "Количество человек" } },
    );
    expect(r.name).toBe("Мадина Юсупова");
    expect(r.source).toBe("META_FB");
    expect(r.phone).toBe("90 123 45 67"); // нормализация — при сохранении
    expect(r.destination).toBe("Мекка и Медина");
    expect(r.travelFrom?.toISOString()).toBe("2026-11-14T19:00:00.000Z");
    expect(r.travelers).toBe(5);
    const answers = r.formAnswers as unknown as { label: string }[];
    expect(answers.map((a) => a.label)).toEqual(["Направление", "Дата вылета", "Количество человек"]);
  });

  it("понимает узбекские вопросы и несколько вариантов ответа", () => {
    const r = parseMetaLead({
      ...base,
      campaign_name: "Viza 2026",
      field_data: [
        { name: "ismingiz", values: ["Jasur"] },
        { name: "telefon_raqamingiz", values: ["+998 93 555 44 33"] },
        { name: "qayerga_sayohat?", values: ["Turkiya", "Dubay"] },
      ],
    });
    expect(r.name).toBe("Jasur");
    expect(r.destination).toBe("Turkiya, Dubay");
    expect(r.serviceType).toBe("VISA");
    // «telefon_raqamingiz» — не стандартный ключ: номер уходит в ответы формы
    expect((r.formAnswers as unknown as unknown[]).length).toBe(2);
  });

  it("лид без имени и без field_data", () => {
    const r = parseMetaLead({ ...base, field_data: undefined });
    expect(r.name).toBe("Без имени");
    expect(r.formAnswers).toBeUndefined();
  });
});

describe("вспомогательные функции", () => {
  it("parseMetaTime понимает смещение +0000", () => {
    expect(parseMetaTime("2026-01-02T03:04:05+0000").toISOString()).toBe("2026-01-02T03:04:05.000Z");
    expect(parseMetaTime("2026-01-02T08:04:05+0500").toISOString()).toBe("2026-01-02T03:04:05.000Z");
    expect(() => parseMetaTime("мусор")).toThrow();
  });
  it("parseAnswerDate", () => {
    expect(parseAnswerDate("15.10.2026")?.toISOString()).toBe("2026-10-14T19:00:00.000Z");
    expect(parseAnswerDate("5/1/2027")?.toISOString()).toBe("2027-01-04T19:00:00.000Z");
    expect(parseAnswerDate("в октябре")).toBeNull();
  });
  it("guessService", () => {
    expect(guessService("Авиабилеты по лучшим ценам")).toBe("FLIGHTS");
    expect(guessService("Тур в Турцию")).toBe("TOUR");
    expect(guessService("Виза в Корею")).toBe("VISA");
    expect(guessService("что-то")).toBeNull();
  });
});

describe("органические лиды", () => {
  const base: MetaLead = { id: "1", created_time: "2026-10-14T05:00:00+0000", campaign_id: "c1", campaign_name: "Чудеса Турции", platform: "ig" };
  it("сохраняет признак is_organic, кампанию оставляет для справки", () => {
    expect(parseMetaLead({ ...base, is_organic: true })).toMatchObject({ isOrganic: true, campaignName: "Чудеса Турции" });
    expect(parseMetaLead({ ...base, is_organic: false }).isOrganic).toBe(false);
    expect(parseMetaLead(base).isOrganic).toBeNull();
  });
});

describe("имя из своего вопроса формы", () => {
  const lead = (name: string, value: string): MetaLead => ({
    id: "2",
    created_time: "2026-10-14T05:00:00+0000",
    field_data: [
      { name, values: [value] },
      { name: "phone_number", values: ["+998901234567"] },
    ],
  });
  it("узнаёт «Ваше имя?», «Ismingiz?», «Как к вам обращаться?»", () => {
    expect(parseMetaLead(lead("ваше_имя?", "Алишер")).name).toBe("Алишер");
    expect(parseMetaLead(lead("ismingiz_va_familiyangiz", "Dilnoza Karimova")).name).toBe("Dilnoza Karimova");
    expect(parseMetaLead(lead("q1", "Бобур"), { labels: { q1: "Как к вам обращаться?" } }).name).toBe("Бобур");
    expect(parseMetaLead(lead("ism-familiya", "Aziz")).name).toBe("Aziz");
  });
  it("не путает с другими вопросами и не берёт номер вместо имени", () => {
    expect(parseMetaLead(lead("куда_хотите_поехать?", "Турция")).name).toBe("Без имени");
    expect(parseMetaLead(lead("company_name", "Orient")).name).toBe("Без имени");
    expect(parseMetaLead(lead("ваше_имя", "998901234567")).name).toBe("Без имени");
  });
  it("достаёт имя из сохранённых ответов", () => {
    expect(nameFromAnswers([{ key: "q1", label: "Ismingiz?", value: "Jasur" }])).toBe("Jasur");
    expect(nameFromAnswers([{ key: "q2", label: "Куда хотите поехать?", value: "Дубай" }])).toBeNull();
    expect(nameFromAnswers(null)).toBeNull();
  });
});

describe("телефон в своём вопросе формы", () => {
  const lead = (fields: { name: string; values: string[] }[]): MetaLead => ({ ...base, field_data: fields });
  it("«Номер телефона для связи?» попадает в телефон лида", () => {
    const r = parseMetaLead(lead([{ name: "full_name", values: ["Уктамов Шахзод"] }, { name: "номер_телефона_для_связи?", values: ["+998 90 123 45 67"] }]), {});
    expect(r.phone).toBe("+998 90 123 45 67");
    expect(r.name).toBe("Уктамов Шахзод");
  });
  it("вопрос без слова «телефон» — берётся ответ, похожий на номер, а не число туристов", () => {
    const r = parseMetaLead(lead([{ name: "сколько_человек?", values: ["2"] }, { name: "aloqa_uchun", values: ["901234567"] }]), {});
    expect(r.phone).toBe("901234567");
    expect(r.travelers).toBe(2);
  });
  it("номер из сохранённых ответов для старых лидов", () => {
    expect(phoneFromAnswers([{ key: "q1", label: "Куда?", value: "Таиланд" }, { key: "q2", label: "Telefon raqamingiz", value: "93 100 91 23" }])).toBe("93 100 91 23");
    expect(phoneFromAnswers([{ key: "q1", label: "Куда?", value: "Дубай 2026" }])).toBeNull();
  });
});

describe("туристы и дата выезда из ответов формы", () => {
  it("берёт ответы как есть, если их не разобрать в число и дату", () => {
    expect(
      tripFromAnswers([
        { key: "q1", label: "Сколько человек поедет?", value: "2 взрослых и ребёнок" },
        { key: "q2", label: "Примерная дата выезда", value: "в ноябре" },
      ]),
    ).toEqual({ people: "2 взрослых и ребёнок", when: "в ноябре" });
    expect(tripFromAnswers(null)).toEqual({ people: null, when: null });
  });
});
