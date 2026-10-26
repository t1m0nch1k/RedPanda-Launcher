import React from "react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import {
  IconShieldCheck,
  IconLock,
  IconCookie,
  IconCheck,
  IconUser,
  IconDatabase,
  IconAd,
  IconServer,
  IconWorldShare,
  IconFileCertificate,
  IconCopyright,
  IconMail,
} from "@tabler/icons-react";

export const metadata = {
  title: "Политика конфиденциальности и Cookies — RedPanda Launcher",
  description: "Политика обработки персональных данных и файлов cookie сайта RedPanda Launcher (redlauncher.ru). Оператор, цели, состав данных, срок хранения, передача третьим лицам и порядок обращений субъектов персональных данных.",
};

const OPERATOR_NAME = "Иноземцев Артём Витальевич";
const OPERATOR_EMAIL = "in.artem2@yandex.ru";
const SUPPORT_EMAIL = "support@redlauncher.ru";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full font-mono">
        <div className="mb-8 pb-6 border-b border-border">
          <div className="flex items-center gap-2 text-primary text-xs uppercase tracking-widest mb-2">
            <IconShieldCheck size={16} />
            <span>Legal Documentation</span>
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight text-foreground leading-tight">
            Политика обработки персональных данных
          </h1>
          <p className="text-muted text-xs sm:text-sm mt-2">
            Редакция от 26 октября 2026 года · Сайт redlauncher.ru и приложение RedPanda Launcher
          </p>
        </div>

        <div className="brutalist-card p-6 sm:p-10 space-y-10 text-xs sm:text-sm leading-relaxed">
          {/* 1. Оператор */}
          <section id="operator" className="space-y-3 scroll-mt-24">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase flex items-center gap-2">
              <IconUser size={18} />
              1. Сведения об операторе персональных данных
            </h2>
            <p className="text-muted">
              Оператором обработки персональных данных на сайте <strong className="text-foreground">redlauncher.ru</strong> и
              в приложении <strong className="text-foreground">RedPanda Launcher</strong> является физическое лицо:{" "}
              <strong className="text-foreground">{OPERATOR_NAME}</strong>.
            </p>
            <ul className="space-y-2 text-muted pl-4">
              <li className="flex items-start gap-2">
                <IconMail size={14} className="text-primary shrink-0 mt-0.5" />
                <span>
                  E-mail для обращений по вопросам персональных данных:{" "}
                  <strong className="text-foreground">{OPERATOR_EMAIL}</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <IconMail size={14} className="text-primary shrink-0 mt-0.5" />
                <span>
                  Техническая поддержка и прочие обращения:{" "}
                  <strong className="text-foreground">{SUPPORT_EMAIL}</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <IconMail size={14} className="text-primary shrink-0 mt-0.5" />
                <span>Сообщество: Telegram <strong className="text-foreground">@redpanda_launcher</strong></span>
              </li>
            </ul>
            <p className="text-muted">
              Обращение по любому из указанных адресов является достаточным для реализации прав субъекта персональных
              данных, предусмотренных Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных».
            </p>
          </section>

          {/* 2. Состав данных */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase flex items-center gap-2">
              <IconDatabase size={18} />
              2. Состав обрабатываемых данных
            </h2>
            <p className="text-muted">Оператор не запрашивает и не хранит ФИО, паспортные данные, телефон и иную чувствительную информацию. Обрабатываются следующие категории данных:</p>
            <ul className="space-y-1.5 text-muted pl-4">
              <li>• <strong className="text-foreground">Технические данные визита:</strong> IP-адрес, тип и версия браузера/устройства (User-Agent), дата и время обращения, запрошенные страницы — фиксируются в журналах посещений автоматически при обращении к сайту.</li>
              <li>• <strong className="text-foreground">Данные, хранимые в вашем браузере:</strong> файлы cookie (в том числе рекламного блока Яндекса) и значение согласия <code className="text-primary">redpanda_cookie_consent</code> в localStorage браузера.</li>
              <li>• <strong className="text-foreground">Данные, обрабатываемые локально в приложении:</strong> учётные данные аккаунта Minecraft/токены авторизации, список сборок и настроек. Они хранятся только на вашем устройстве, шифруются средствами Windows DPAPI или AES-256-GCM и не передаются на сайте Оператора.</li>
              <li>• <strong className="text-foreground">Данные ваших обращений:</strong> e-mail и содержание письма/сообщения, если вы сами пишете оператору.</li>
            </ul>
          </section>

          {/* 3. Цели и основания */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase flex items-center gap-2">
              <IconFileCertificate size={18} />
              3. Цели обработки и правовые основания
            </h2>
            <ul className="space-y-2 text-muted pl-4">
              <li className="flex items-start gap-2">
                <IconCheck size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span><strong className="text-foreground">Работоспособность сайта</strong> (безопасность, распределение нагрузки, защита от атак) — на основании ч. 1 ст. 6 152-ФЗ и законного интереса Оператора.</span>
              </li>
              <li className="flex items-start gap-2">
                <IconCheck size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span><strong className="text-foreground">Запоминание ваших настроек</strong> (тема, язык, фильтры каталога модов) и хранение вашего выбора относительно cookie — на основании согласия (cookie-баннер).</span>
              </li>
              <li className="flex items-start gap-2">
                <IconCheck size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span><strong className="text-foreground">Показ рекламных объявлений</strong> через сеть Яндекса (РСЯ) — исключительно на основании分离 согласия, которое вы даёте в cookie-баннере и можете отозвать.</span>
              </li>
              <li className="flex items-start gap-2">
                <IconCheck size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span><strong className="text-foreground">Ответы на ваши обращения</strong> — на основании вашего согласия, выраженного направлением письма.</span>
              </li>
            </ul>
          </section>

          {/* 4. Cookie */}
          <section id="cookies" className="space-y-3 scroll-mt-24">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase flex items-center gap-2">
              <IconCookie size={18} />
              4. Файлы cookie и похожие технологии
            </h2>
            <p className="text-muted">
              Рекламные и аналитические скрипты <strong className="text-foreground">не загружаются</strong> на сайт, пока вы
              не дали согласие в cookie-баннере (первый визит). Обязательные cookie работают всегда. Управлять согласием
              можно в любой момент — кнопкой «Параметры конфиденциальности» в подвале сайта либо очисткой данных сайта
              в браузере.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] sm:text-xs border-collapse">
                <thead>
                  <tr className="text-left text-muted uppercase tracking-wider border-b border-border">
                    <th className="py-2 pr-3">Категория</th>
                    <th className="py-2 pr-3">Примеры</th>
                    <th className="py-2 pr-3">Цель</th>
                    <th className="py-2">Срок хранения</th>
                  </tr>
                </thead>
                <tbody className="text-muted align-top">
                  <tr className="border-b border-border/40">
                    <td className="py-2 pr-3 font-bold text-foreground">Обязательные</td>
                    <td className="py-2 pr-3">redpanda_cookie_consent (localStorage)</td>
                    <td className="py-2 pr-3">Запоминание выбора по cookie и настроек интерфейса</td>
                    <td className="py-2">До отзыва согласия / очистки данных сайта, максимум 12 месяцев</td>
                  </tr>
                  <tr className="border-b border-border/40">
                    <td className="py-2 pr-3 font-bold text-foreground">Рекламные (РСЯ)</td>
                    <td className="py-2 pr-3">yandexuid, yandex_cgi, i и другие cookies Яндекса</td>
                    <td className="py-2 pr-3">Показ объявлений, частотность, персонализация, статистика</td>
                    <td className="py-2">До 2 лет (сроки определяются Яндексом)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-muted">
              Полный перечень cookies рекламного блока см. в документации Яндекс Рекламной Сети:
              https://yandex.ru/legal/rgs/ и Политике конфиденциальности Яндекса: https://yandex.ru/legal/confidential/
            </p>
          </section>

          {/* 5. Реклама */}
          <section id="ads" className="space-y-3 scroll-mt-24">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase flex items-center gap-2">
              <IconAd size={18} />
              5. Реклама
            </h2>
            <p className="text-muted">
              На сайте демонстрируется реклама через Яндекс Рекламную Сеть (РСЯ), оператором которой является ООО «ЯНДЕКС»
              (119021, Россия, г. Москва, ул. Льва Толстого, 16). Рекламные объявления маркируются Яндексом как реклама,
              согласно российскому законодательству о рекламе (ФЗ-38, включая требования к маркировке интернет-рекламы
              и передаче сведений в ЕРИР).
            </p>
            <p className="text-muted">
              Скрипты РСЯ подключаются к странице <strong className="text-foreground">только после вашего согласия</strong>,
              полученного через cookie-баннер. Отказ не влияет на функциональность сайта. Вы можете отозвать согласие в
              любой момент (пункт 4) и дополнительно настроить показ рекламы на стороне Яндекса.
            </p>
          </section>

          {/* 6. Передача третьим лицам */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase flex items-center gap-2">
              <IconWorldShare size={18} />
              6. Передача данных третьим лицам и трансграничная передача
            </h2>
            <p className="text-muted">
              Оператор не продаёт и не передаёт персональные данные в аренду. Данные передаются следующим
              обработчикам/получателям в объёме, необходимом для их функций:
            </p>
            <ul className="space-y-1.5 text-muted pl-4">
              <li>• <strong className="text-foreground">ООО «ЯНДЕКС»</strong> (РФ) — рекламная сеть РСЯ (после согласия на рекламные cookie);</li>
              <li>• <strong className="text-foreground">Хостинг-провайдер и CDN (Cloudflare, США)</strong> — техническое обслуживание сайта; в сетевых журналах могут фигурировать IP-адреса посетителей;</li>
              <li>• <strong className="text-foreground">Mojang AB / Microsoft</strong> (Швеция/США) — только в приложении, по вашему запросу: загрузка файлов игры и проверка лицензии с использованием вашего собственного токена авторизации;</li>
              <li>• <strong className="text-foreground">Modrinth</strong> (США) и <strong className="text-foreground">Overwolf / CurseForge</strong> (США/Израиль) — в приложении, каталог и загрузка модификаций по вашему запросу;</li>
              <li>• <strong className="text-foreground">Valve / Steam и e4mc</strong> — в приложении, P2P-соединение для игры по сети по вашему запросу;</li>
              <li>• <strong className="text-foreground">Канал связи (Telegram, e-mail)</strong> — когда вы сами обращаетесь к оператору.</li>
            </ul>
            <p className="text-muted">
              <strong className="text-foreground">Локализация и трансграничная передача.</strong> Сайт и его инфраструктура
              размещены на зарубежных серверах (США), поэтому при обращении к сайту данные жителей РФ передаются за
              пределы территории Российской Федерации. Оператор принимает необходимые правовые и организационные меры,
              предусмотренные ст. 12 и ст. 18.1 152-ФЗ, и направляет в Роскомнадзор уведомление о трансграничной
              передаче и обязательное уведомление об обработке персональных данных. После включения Оператора
              в <a href="https://rkn.gov.ru/personal-data/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary-hover">реестр операторов ПД</a>{" "}
              эта политика будет дополнена регистрационными данными.
            </p>
          </section>

          {/* 7. Хранение */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase flex items-center gap-2">
              <IconServer size={18} />
              7. Сроки хранения данных
            </h2>
            <ul className="space-y-1.5 text-muted pl-4">
              <li>• Журналы посещений сайта — по стандартным срокам хранения хостинг-провайдера (как правило, до 30–90 дней);</li>
              <li>• Cookie согласия (localStorage) — до отзыва согласия, но не более 12 месяцев;</li>
              <li>• Рекламные cookies — см. пункт 4;</li>
              <li>• Переписка с оператором — до 1 года с момента последнего обращения (или до момента удаления по запросу субъекта);</li>
              <li>• Локальные данные приложения — удаляются вместе с профилем Windows либо вручную пользователем.</li>
            </ul>
          </section>

          {/* 8. Права субъекта */}
          <section id="data" className="space-y-3 scroll-mt-24">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase flex items-center gap-2">
              <IconLock size={18} />
              8. Права субъектов персональных данных и порядок обращений
            </h2>
            <p className="text-muted">
              Вы имеете право: получить информацию об обработке своих данных; требовать уточнения, блокирования или
              уничтожения данных, если они неполны, устарели, неточны или незаконны; отозвать согласие на обработку;
              обжаловать действия Оператора в Роскомнадзор или в суд.
            </p>
            <p className="text-muted">
              Чтобы реализовать эти права, направьте запрос на <strong className="text-foreground">{OPERATOR_EMAIL}</strong> с
              темы «Персональные данные». Запрос может быть подписан электронной подписью или подтверждён любым иным
              способом, позволяющим достоверно установить личность. <strong className="text-foreground">Срок ответа — не позднее 10 рабочих дней</strong> с
              момента получения уточнённого запроса (для запросов на уничтожение и отзыв согласия — не позднее 30 дней,
              если не требуется дополнительная проверка). Если вы считаете, что обработка нарушает ваши права, вы
              вправе обратиться в Роскомнадзор: https://rkn.gov.ru/treatments/
            </p>
          </section>

          {/* 9. Безопасность */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase flex items-center gap-2">
              <IconShieldCheck size={18} />
              9. Меры защиты
            </h2>
            <p className="text-muted">
              Данные передаются по HTTPS. Авторизационные токены лаунчера защищаются локально средствами{" "}
              <strong className="text-foreground">Windows DPAPI</strong>, привязанными к профилю пользователя; резервный
              совместимый формат использует AES-256-GCM. Токены не передаются веб-сайту. Проект с открытым исходным
              кодом (https://github.com/t1m0nch1k/RedPanda-Launcher), принципиально не занимается скрытым сбором,
              анализом или продажей личных данных пользователей.
            </p>
          </section>

          {/* 10. Изменения */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase flex items-center gap-2">
              <IconCopyright size={18} />
              10. Изменение политики
            </h2>
            <p className="text-muted">
              Оператор вправе изменять настоящую Политику, включая требования ч. 2 ст. 18.1 152-ФЗ об обязательном
              опубликовании документа, определяющего политику обработки персональных данных. Новая редакция вступает в
              силу с момента публикации, если не предусмотрено иное. Актуальная редакция всегда доступна на этой
              странице. Существенные изменения дополнительно отмечаются в журнале изменений сайта.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
