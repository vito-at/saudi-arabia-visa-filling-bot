import type { Metadata } from "next";
import { Logo } from "@/components/layout/logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getI18n } from "@/i18n/server";
import type { Locale } from "@/i18n/config";

export const metadata: Metadata = { title: "Privacy Policy — Orient Travel" };

/**
 * Публичная политика конфиденциальности (без входа в CRM).
 * Её адрес указывается в Meta for Developers: «Настройки приложения → Основное → URL политики конфиденциальности».
 */
const TEXT: Record<Locale, { title: string; updated: string; sections: [string, string[]][] }> = {
  ru: {
    title: "Политика конфиденциальности Orient Travel",
    updated: "Действует с 1 октября 2026 г.",
    sections: [
      ["Кто мы", ["Orient Travel — туристическое агентство в Фергане (Узбекистан). Эта политика описывает, как мы обрабатываем данные, которые вы оставляете в рекламных формах Facebook и Instagram, в мессенджерах и при обращении в офис."]],
      ["Какие данные мы получаем", ["Имя, номер телефона, адрес электронной почты (если указан) и ответы на вопросы формы: направление, даты поездки, количество туристов и т. п.", "Название рекламной кампании и формы, через которую пришла заявка."]],
      ["Зачем", ["Чтобы связаться с вами, подобрать и оформить тур, авиабилеты или визу, а также вести учёт обращений и продаж в нашей внутренней CRM-системе."]],
      ["Кому передаём", ["Данные доступны только сотрудникам Orient Travel. Мы не продаём и не передаём их третьим лицам, кроме случаев, когда это нужно для оформления вашей поездки (авиакомпании, отели, консульства) или требуется по закону."]],
      ["Хранение и защита", ["Данные хранятся на защищённом сервере, доступ — только по логину и паролю сотрудника, соединение шифруется (HTTPS). Ключи доступа к Meta хранятся в зашифрованном виде."]],
      ["Удаление данных", ["Вы можете в любой момент попросить удалить ваши данные: напишите нам в сообщения страницы Orient Travel в Facebook или Instagram либо обратитесь в офис. Мы удалим заявку и связанные с ней данные в течение 30 дней."]],
    ],
  },
  uz: {
    title: "Orient Travel maxfiylik siyosati",
    updated: "2026-yil 1-oktabrdan amal qiladi.",
    sections: [
      ["Biz kimmiz", ["Orient Travel — Farg‘onadagi (O‘zbekiston) sayyohlik agentligi. Ushbu siyosat Facebook va Instagram reklama shakllarida, messenjerlarda va ofisga murojaat qilganingizda qoldirgan ma’lumotlaringizni qanday qayta ishlashimizni tavsiflaydi."]],
      ["Qanday ma’lumotlarni olamiz", ["Ism, telefon raqami, elektron pochta (agar ko‘rsatilgan bo‘lsa) va shakl savollariga javoblar: yo‘nalish, sayohat sanalari, sayyohlar soni va h.k.", "Ariza kelgan reklama kampaniyasi va shakl nomi."]],
      ["Nima uchun", ["Siz bilan bog‘lanish, tur, aviachipta yoki vizani tanlash va rasmiylashtirish, shuningdek ichki CRM tizimimizda murojaatlar va sotuvlarni hisobga olish uchun."]],
      ["Kimga beramiz", ["Ma’lumotlar faqat Orient Travel xodimlariga ochiq. Ularni sotmaymiz va uchinchi shaxslarga bermaymiz, sayohatingizni rasmiylashtirish (aviakompaniyalar, mehmonxonalar, konsulliklar) yoki qonun talabi bundan mustasno."]],
      ["Saqlash va himoya", ["Ma’lumotlar himoyalangan serverda saqlanadi, kirish faqat xodim login va paroli bilan, ulanish shifrlangan (HTTPS). Meta kirish kalitlari shifrlangan holda saqlanadi."]],
      ["Ma’lumotlarni o‘chirish", ["Istalgan vaqtda ma’lumotlaringizni o‘chirishni so‘rashingiz mumkin: Orient Travel’ning Facebook yoki Instagram sahifasiga xabar yozing yoki ofisga murojaat qiling. Arizani va unga bog‘liq ma’lumotlarni 30 kun ichida o‘chiramiz."]],
    ],
  },
  en: {
    title: "Orient Travel Privacy Policy",
    updated: "Effective October 1, 2026.",
    sections: [
      ["Who we are", ["Orient Travel is a travel agency in Fergana, Uzbekistan. This policy explains how we process the data you leave in Facebook and Instagram lead forms, in messengers and when contacting our office."]],
      ["What we collect", ["Name, phone number, email (if provided) and your answers to the form questions: destination, travel dates, number of travellers, etc.", "The name of the ad campaign and form the request came from."]],
      ["Why", ["To contact you, to find and book a tour, flights or a visa, and to keep track of requests and sales in our internal CRM system."]],
      ["Sharing", ["The data is available only to Orient Travel staff. We do not sell it or share it with third parties, except when needed to arrange your trip (airlines, hotels, consulates) or when required by law."]],
      ["Storage and security", ["Data is stored on a protected server, access requires a staff login and password, and the connection is encrypted (HTTPS). Meta access keys are stored encrypted."]],
      ["Data deletion", ["You can ask us to delete your data at any time: message the Orient Travel page on Facebook or Instagram or contact our office. We will delete the request and related data within 30 days."]],
    ],
  },
};

export default async function PrivacyPage() {
  const { locale } = await getI18n();
  const c = TEXT[locale] ?? TEXT.ru;
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Logo className="h-10" />
          <div className="w-44">
            <LanguageSwitcher />
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{c.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{c.updated}</p>
        <div className="mt-8 space-y-6">
          {c.sections.map(([h, ps]) => (
            <section key={h}>
              <h2 className="mb-2 font-semibold">{h}</h2>
              {ps.map((p) => (
                <p key={p} className="mb-2 text-sm leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
