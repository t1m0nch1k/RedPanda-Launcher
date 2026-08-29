import React from "react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { 
  IconMail, 
  IconBrandTelegram, 
  IconBrandGithub, 
  IconShieldCheck, 
  IconAlertTriangle,
  IconClock,
  IconMessageCircle2
} from "@tabler/icons-react";

export const metadata = {
  title: "Контакты и обратная связь — RedPanda Launcher",
  description: "Официальные контакты команды RedPanda Launcher, связь с разработчиками, поддержка и обращения для правообладателей (DMCA).",
};

export default function ContactsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full font-mono">
        <div className="mb-10 pb-6 border-b border-border">
          <div className="flex items-center gap-2 text-primary text-xs uppercase tracking-widest mb-2">
            <IconMessageCircle2 size={16} />
            <span>Support & Communications</span>
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-5xl uppercase tracking-tight text-foreground mb-3">
            Контакты и поддержка
          </h1>
          <p className="text-muted text-xs sm:text-sm max-w-2xl leading-relaxed">
            Каналы связи с разработчиками RedPanda Launcher: техническая помощь, сообщение об уязвимостях и юридические запросы.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Быстрая поддержка */}
          <div className="brutalist-card p-6 sm:p-8 space-y-6">
            <h2 className="font-display font-bold text-lg text-primary uppercase flex items-center gap-2">
              <IconBrandTelegram size={20} />
              Сообщество & Поддержка
            </h2>
            <p className="text-muted text-xs leading-relaxed">
              Оперативное решение вопросов по установке, модам, запуску игры и совместному мультиплееру:
            </p>

            <div className="space-y-3 text-xs">
              <a
                href="https://t.me/redpanda_launcher"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3.5 bg-background border border-border hover:border-primary transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <IconBrandTelegram size={18} className="text-sky-400" />
                  <div>
                    <p className="font-bold text-foreground group-hover:text-primary">Telegram Канал</p>
                    <p className="text-[10px] text-muted">@redpanda_launcher</p>
                  </div>
                </div>
                <span className="text-[10px] text-primary uppercase font-bold">Перейти →</span>
              </a>

              <a
                href="https://github.com/t1m0nch1k/RedPanda-Launcher/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3.5 bg-background border border-border hover:border-primary transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <IconBrandGithub size={18} className="text-foreground" />
                  <div>
                    <p className="font-bold text-foreground group-hover:text-primary">GitHub Issues</p>
                    <p className="text-[10px] text-muted">Баг-трекер и предложения</p>
                  </div>
                </div>
                <span className="text-[10px] text-primary uppercase font-bold">Открыть →</span>
              </a>
            </div>
          </div>

          {/* Безопасность и правообладатели */}
          <div className="brutalist-card p-6 sm:p-8 space-y-6">
            <h2 className="font-display font-bold text-lg text-primary uppercase flex items-center gap-2">
              <IconShieldCheck size={20} />
              Правообладателям & Security
            </h2>
            <p className="text-muted text-xs leading-relaxed">
              По вопросам авторских прав, товарных знаков и сообщений о критических уязвимостях (Security Vulnerability Reports):
            </p>

            <div className="p-4 bg-background border border-border space-y-2 text-xs">
              <p className="text-muted text-[11px]">Официальный e-mail для юридических обращений:</p>
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <IconMail size={16} />
                <span>support@redlauncher.ru</span>
              </div>
              <p className="text-[10px] text-muted pt-1 flex items-center gap-1">
                <IconClock size={12} />
                <span>Время рассмотрения обращений: до 24 часов</span>
              </p>
            </div>
          </div>
        </div>

        {/* Порядок рассмотрения обращений правообладателей (DMCA / Авторские права) */}
        <div className="brutalist-card p-6 sm:p-8 space-y-4">
          <h2 className="font-display font-bold text-base uppercase text-foreground flex items-center gap-2">
            <IconAlertTriangle size={18} className="text-amber-400" />
            Порядок рассмотрения обращений правообладателей
          </h2>
          <p className="text-muted text-xs leading-relaxed">
            RedPanda Launcher уважает права интеллектуальной собственности авторов модификаций, ресурс-паков и правообладателей торговых марок.
            Если вы считаете, что какой-либо материал на сайте или в каталоге нарушает ваши авторские права, направьте уведомление на{" "}
            <strong className="text-foreground">support@redlauncher.ru</strong> с указанием прямой ссылки на спорный материал и документов, подтверждающих полномочия. Спорный контент будет незамедлительно удален или скорректирован.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
