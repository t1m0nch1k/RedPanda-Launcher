import React from "react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { IconTrademark } from "@tabler/icons-react";

export const metadata = {
  title: "Товарные знаки и авторские права — RedPanda Launcher",
  description: "Информация о товарных знаках Minecraft, Mojang AB, Microsoft и авторских правах.",
};

export default function LegalPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full font-mono">
        <div className="mb-8 pb-6 border-b border-border">
          <div className="flex items-center gap-2 text-primary text-xs uppercase tracking-widest mb-2">
            <IconTrademark size={16} />
            <span>Trademark Notice</span>
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl uppercase tracking-tight text-foreground">
            Товарные знаки и дисклеймер
          </h1>
        </div>

        <div className="brutalist-card p-6 sm:p-10 space-y-6 text-xs sm:text-sm leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase">
              1. Товарные знаки Minecraft и Mojang
            </h2>
            <p className="text-muted">
              «Minecraft» является зарегистрированным товарным знаком компании <strong className="text-foreground">Mojang AB</strong> (дочерняя компания Microsoft Corporation).
            </p>
            <p className="text-muted">
              RedPanda Launcher является независимым сторонним программным продуктом с открытым исходным кодом, разработанным сообществом. RedPanda Launcher не был одобрен, проверен или создан компанией Mojang AB или Microsoft, а также не связан с ними.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase">
              2. Товарные знаки сторонних сервисов
            </h2>
            <p className="text-muted">
              Названия Modrinth, CurseForge, Steam, Ely.by и соответствующие логотипы являются собственностью их законных правообладателей и используются исключительно в справочных целях для идентификации поддерживаемых платформ.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
