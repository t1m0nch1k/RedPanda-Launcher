import React from "react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { IconShieldCheck, IconLock, IconCookie, IconCheck } from "@tabler/icons-react";

export const metadata = {
  title: "Политика конфиденциальности и Cookies — RedPanda Launcher",
  description: "Политика конфиденциальности, защита персональных данных и использование файлов cookie на сайте RedPanda Launcher.",
};

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
            Конфиденциальность и файлы cookie
          </h1>
          <p className="text-muted text-xs sm:text-sm mt-2">
            Последнее обновление: 29 августа 2026 года
          </p>
        </div>

        <div className="brutalist-card p-6 sm:p-10 space-y-8 text-xs sm:text-sm leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase flex items-center gap-2">
              <IconLock size={18} />
              1. Общие положения и безопасность
            </h2>
            <p className="text-muted">
              RedPanda Launcher является открытым программным обеспечением (Open Source). Мы уважаем ваше право на конфиденциальность и принципиально не занимаемся скрытым сбором, анализом или продажей личных данных пользователей третьим лицам.
            </p>
            <p className="text-muted">
              Все сессионные данные, авторизационные токены и пароли в лаунчере шифруются локально на вашем компьютере с использованием криптографического стандарта <strong className="text-foreground">AES-256-GCM</strong> с рандомизированным Nonce и уникальным аппаратным ключом.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase flex items-center gap-2">
              <IconCookie size={18} />
              2. Использование файлов cookie
            </h2>
            <p className="text-muted">
              На сайте <strong className="text-foreground">redlauncher.ru</strong> файлы cookie используются исключительно для:
            </p>
            <ul className="space-y-2 text-muted pl-4">
              <li className="flex items-start gap-2">
                <IconCheck size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>Корректной работы базового функционала веб-сайта и сохранения пользовательских настроек (тема, язык, фильтры).</span>
              </li>
              <li className="flex items-start gap-2">
                <IconCheck size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>Показа релевантных рекламных объявлений партнёрской сети Яндекс (РСЯ) и предотвращения повторных показов.</span>
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase">
              3. Сторонние сервисы и API
            </h2>
            <p className="text-muted">
              Лаунчер и сайт взаимодействуют с публичными API-сервисами исключительно по прямому запросу пользователя:
            </p>
            <ul className="space-y-1.5 text-muted pl-4">
              <li>• <strong className="text-foreground">Mojang / Microsoft</strong> — для загрузки оригинальных файлов игры и проверки официальных лицензий.</li>
              <li>• <strong className="text-foreground">Modrinth & CurseForge</strong> — для каталога и автоматической установки модификаций.</li>
              <li>• <strong className="text-foreground">e4mc / Steam</strong> — для создания P2P-соединения при игре по сети без открытия портов.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display font-bold text-base sm:text-lg text-primary uppercase">
              4. Управление и удаление данных
            </h2>
            <p className="text-muted">
              Пользователь имеет право в любой момент очистить кэш, удалить локальные аккаунты или отключить файлы cookie в настройках своего браузера.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
