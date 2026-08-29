import React from "react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { IconFileText } from "@tabler/icons-react";

export const metadata = {
  title: "Условия использования — RedPanda Launcher",
  description: "Условия использования программного обеспечения RedPanda Launcher и официального сайта.",
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
          <h1 className="font-display font-bold text-3xl sm:text-4xl uppercase tracking-tight text-foreground">
            Условия использования
          </h1>
          <p className="text-muted text-xs sm:text-sm mt-2">
            Редакция от 29 августа 2026 года
          </p>
        </div>

        <div className="brutalist-card p-6 sm:p-10 space-y-8 text-xs sm:text-sm leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase">
              1. Лицензия и статус проекта
            </h2>
            <p className="text-muted">
              RedPanda Launcher предоставляется бесплатно по лицензии с открытым исходным кодом. Вы имеете право свободно использовать, изучать и запускать лаунчер для личных и образовательных целей.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase">
              2. Отказ от ответственности (As Is)
            </h2>
            <p className="text-muted">
              Программное обеспечение и все связанные материалы на сайте предоставляются по принципу «как есть» (AS IS). Разработчики не несут ответственности за возможные сбои в работе сторонних модификаций, плагинов или игровых серверов.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase">
              3. Соблюдение правил Mojang и EULA
            </h2>
            <p className="text-muted">
              Пользователи обязуются соблюдать официальное лицензионное соглашение конечного пользователя Minecraft (Mojang EULA). Лаунчер не обходит системы защиты серверов и предназначен для честной игры.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
