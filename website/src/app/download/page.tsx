import React from "react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import {
  IconDownload, 
  IconShieldCheck, 
  IconCpu, 
  IconDeviceDesktop, 
  IconBrandWindows,
  IconArrowUpRight
} from "@tabler/icons-react";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.3.0";

const RELEASE_TAG = "v0.3.0_fix2";

export const metadata = {
  title: "Скачать RedPanda Launcher для Windows",
  description: "Официальный установщик RedPanda Launcher для Windows 10/11 x64 с поддержкой Modrinth и CurseForge.",
};

export default function DownloadPage() {
  const downloadUrl = `https://github.com/t1m0nch1k/RedPanda-Launcher/releases/download/${RELEASE_TAG}/RedPanda_Setup_${APP_VERSION}.exe`;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Заголовок */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-widest px-3 py-1 bg-primary/10 border border-primary/30 mb-4">
            <IconBrandWindows size={16} />
            <span>Windows 10 / 11 (x64) Verified</span>
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-6xl uppercase tracking-tight text-foreground mb-4 break-words">
            Скачать RedPanda Launcher
          </h1>
          <p className="text-muted text-sm sm:text-base max-w-2xl mx-auto leading-relaxed font-mono">
            Новейшая стабильная версия <span className="text-primary font-bold">v{APP_VERSION}</span> с диагностикой сборок, управлением модами, кастомным автономным инсталлятором и встроенным P2P мультиплеером.
          </p>
        </div>

        {/* Главная карточка загрузки */}
        <div className="brutalist-card p-8 sm:p-12 mb-12 border-primary/60 brutalist-shadow-orange text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-8">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
              <span className="font-display font-bold text-xl sm:text-3xl text-foreground break-all">
                RedPanda_Setup_{APP_VERSION}.exe
              </span>
              <span className="bg-primary text-black font-bold font-mono text-[10px] uppercase px-2 py-0.5 tracking-wider">
                Official Release
              </span>
            </div>
            <p className="text-muted text-xs sm:text-sm font-mono">
              Автономный графический инсталлятор с автоматической настройкой ярлыков и зависимостей.
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-mono text-muted pt-1">
              <a
                href={`https://github.com/t1m0nch1k/RedPanda-Launcher/releases/tag/${RELEASE_TAG}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:underline text-foreground"
              >
                <IconShieldCheck size={16} className="text-emerald-400" />
                <span>SHA-256 checksum в GitHub Release ({RELEASE_TAG})</span>
              </a>
              <span>Размер указан в GitHub Release</span>
              <span>Лицензия: Open Source (MIT)</span>
            </div>
          </div>

          <a
            href={downloadUrl}
            className="w-full sm:w-auto flex items-center justify-center gap-3 bg-primary hover:bg-primary-hover text-black px-6 sm:px-8 py-4 font-display font-bold text-sm uppercase tracking-wider transition-all brutalist-button shrink-0"
          >
            <IconDownload size={22} />
            <span>Скачать (.exe)</span>
          </a>
        </div>

        {/* Сетка системных требований и шагов */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Системные требования */}
          <div className="brutalist-card p-6 sm:p-8 space-y-4">
            <h2 className="font-display font-bold text-lg uppercase tracking-wider text-primary flex items-center gap-2">
              <IconDeviceDesktop size={20} />
              <span>Системные требования</span>
            </h2>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 py-2 border-b border-border">
                <span className="text-muted">ОС:</span>
                <span className="text-foreground font-bold">Windows 10 / 11 (64-bit)</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 py-2 border-b border-border">
                <span className="text-muted">Процессор:</span>
                <span className="text-foreground">Intel Core i3 / AMD Ryzen 3+</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 py-2 border-b border-border">
                <span className="text-muted">Оперативная память:</span>
                <span className="text-foreground font-bold">4 ГБ (Рекомендуется 8 ГБ+)</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 py-2 border-b border-border">
                <span className="text-muted">Дисковое пространство:</span>
                <span className="text-foreground">150 МБ для лаунчера + игра</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 py-2">
                <span className="text-muted">Java Runtime:</span>
                <span className="text-emerald-400 font-bold">Авто-загрузка (JDK 8/17/21)</span>
              </div>
            </div>
          </div>

          {/* Быстрая установка в 3 шага */}
          <div className="brutalist-card p-6 sm:p-8 space-y-4">
            <h2 className="font-display font-bold text-lg uppercase tracking-wider text-primary flex items-center gap-2">
              <IconCpu size={20} />
              <span>Установка за 3 шага</span>
            </h2>
            <ol className="space-y-3.5 font-mono text-xs">
              <li className="flex items-start gap-3 p-2.5 bg-background border border-border">
                <span className="font-bold text-primary">01</span>
                <div>
                  <p className="font-bold text-foreground">Скачайте Setup</p>
                  <p className="text-muted text-[11px] mt-0.5">Нажмите кнопку «Скачать (.exe)» выше.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 p-2.5 bg-background border border-border">
                <span className="font-bold text-primary">02</span>
                <div>
                  <p className="font-bold text-foreground">Запустите установщик</p>
                  <p className="text-muted text-[11px] mt-0.5">Выберите путь установки и создайте ярлыки на рабочем столе.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 p-2.5 bg-background border border-border">
                <span className="font-bold text-primary">03</span>
                <div>
                  <p className="font-bold text-foreground">Играйте с друзьями</p>
                <p className="text-muted text-[11px] mt-0.5">Добавляйте аккаунты, ставьте моды и играйте с друзьями.</p>
                </div>
              </li>
            </ol>
          </div>
        </div>

        {/* Ссылки на GitHub исходники */}
        <div className="p-6 bg-card/60 border border-border flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs">
          <div>
            <p className="text-foreground font-bold uppercase">Исходный код открыт на GitHub</p>
            <p className="text-muted text-[11px] mt-0.5">Вы можете собрать лаунчер самостоятельно из исходников на Rust & React.</p>
          </div>
          <a
            href="https://github.com/t1m0nch1k/RedPanda-Launcher"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1 font-bold shrink-0"
          >
            <span>Репозиторий GitHub</span>
            <IconArrowUpRight size={14} />
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
