import React from "react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { IconFileText } from "@tabler/icons-react";

const OPERATOR_EMAIL = "in.artem2@yandex.ru";

export const metadata = {
  title: "Условия использования — RedPanda Launcher",
  description: "Условия использования программного обеспечения RedPanda Launcher и официального сайта redlauncher.ru: лицензия, ответственность, порядок изменения условий и разрешения споров.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full font-mono">
        <div className="mb-8 pb-6 border-b border-border">
          <div className="flex items-center gap-2 text-primary text-xs uppercase tracking-widest mb-2">
            <IconFileText size={16} />
            <span>Terms of Service</span>
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight text-foreground leading-tight">
            Условия использования
          </h1>
          <p className="text-muted text-xs sm:text-sm mt-2">
            Редакция от 26 октября 2026 года
          </p>
        </div>

        <div className="brutalist-card p-6 sm:p-10 space-y-8 text-xs sm:text-sm leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase">
              1. Общие положения
            </h2>
            <p className="text-muted">
              Настоящие Условия использования распространяются на сайт <strong className="text-foreground">redlauncher.ru</strong>, официальные телеграм-каналы проекта и приложение <strong className="text-foreground">RedPanda Launcher</strong>. Использование сайта или приложения означает согласие с настоящими Условиями и Политикой конфиденциальности (см. раздел «Конфиденциальность»).
            </p>
            <p className="text-muted">
              Ответственный за работу сайта, рассмотрение юридических обращений и обработку персональных данных:{" "}
              <strong className="text-foreground">Иноземцев Артём Витальевич</strong> ({OPERATOR_EMAIL}).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase">
              2. Лицензия и статус проекта
            </h2>
            <p className="text-muted">
              RedPanda Launcher предоставляется бесплатно по лицензии с открытым исходным кодом (см. файл LICENSE в репозитории). Вы имеете право свободно использовать, изучать и запускать лаунчер для личных и образовательных целей.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase">
              3. Отказ от ответственности (As Is)
            </h2>
            <p className="text-muted">
              Программное обеспечение и все связанные материалы на сайте предоставляются по принципу «как есть» (AS IS). Разработчики не несут ответственности за возможные сбои в работе сторонних модификаций, плагинов или игровых серверов, а также за действия третьих лиц (рекламных сетей, каталогов модов).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase">
              4. Соблюдение правил Mojang и EULA
            </h2>
            <p className="text-muted">
              Пользователи обязуются соблюдать официальное лицензионное соглашение конечного пользователя Minecraft (Mojang EULA). Лаунчер не обходит системы защиты серверов, поддерживает проверку лицензий через сервисы Mojang/Microsoft и предназначен для честной игры.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase">
              5. Порядок изменения условий
            </h2>
            <p className="text-muted">
              Оператор вправе изменять настоящие Условия в любой момент. Новая редакция вступает в силу с момента её публикации на этой странице, если не предусмотрено иное. Существенные изменения отмечаются обновлением даты редакции выше. Продолжение использования сайта или приложения после публикации изменений означает согласие с новой редакцией.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase">
              6. Разрешение споров и применимое право
            </h2>
            <p className="text-muted">
              К настоящим Условиям и всем связанным вопросам применяется право Российской Федерации. До обращения в суд необходимо направить претензию на {OPERATOR_EMAIL} с описанием ситуации; срок ответа на претензию — до 30 календарных дней. Неурегулированные споры рассматриваются в судах Российской Федерации по правилам подсудности, установленным законодательством РФ.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
