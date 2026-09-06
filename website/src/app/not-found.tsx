import React from "react";
import Link from "next/link";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { IconAlertTriangle, IconHome, IconNews, IconDownload } from "@tabler/icons-react";

export const metadata = {
  title: "404 — Страница не найдена | RedPanda Launcher",
  description: "Запрошенная страница не существует или была перемещена.",
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center text-center font-mono">
        <div className="brutalist-card p-8 sm:p-14 border-primary brutalist-shadow-orange w-full max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 text-rose-400 text-xs uppercase tracking-widest px-3 py-1 bg-rose-500/10 border border-rose-500/30">
            <IconAlertTriangle size={16} />
            <span>ERROR_CODE: 0x404_PAGE_NOT_FOUND</span>
          </div>

          <h1 className="font-display font-bold text-6xl sm:text-8xl text-primary tracking-tighter">
            404
          </h1>

          <div className="space-y-2">
            <h2 className="font-display font-bold text-xl sm:text-2xl uppercase text-foreground">
              Запрашиваемый чанк не найден
            </h2>
            <p className="text-muted text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
              Возможно, ссылка устарела или страница была перемещена в другой раздел. Воспользуйтесь быстрой навигацией:
            </p>
          </div>

          {/* Быстрые ссылки */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border">
            <Link
              href="/"
              className="flex items-center justify-center gap-2 p-3 bg-card border border-border hover:border-primary text-xs uppercase font-bold transition-colors group"
            >
              <IconHome size={16} className="text-primary" />
              <span>Главная</span>
            </Link>

            <Link
              href="/minecraft-news"
              className="flex items-center justify-center gap-2 p-3 bg-card border border-border hover:border-primary text-xs uppercase font-bold transition-colors group"
            >
              <IconNews size={16} className="text-primary" />
              <span>Новости</span>
            </Link>

            <Link
              href="/download"
              className="flex items-center justify-center gap-2 p-3 bg-primary text-black text-xs uppercase font-bold brutalist-button transition-colors"
            >
              <IconDownload size={16} />
              <span>Скачать</span>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
