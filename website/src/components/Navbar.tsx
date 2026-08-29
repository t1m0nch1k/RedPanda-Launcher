"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { 
  IconBrandTelegram, 
  IconBrandGithub, 
  IconDownload, 
  IconMenu2, 
  IconX,
  IconNews,
  IconHistory,
  IconPuzzle,
  IconHelp,
  IconHome
} from "@tabler/icons-react";

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: "Главная", href: "/", icon: IconHome },
    { name: "Новости", href: "/minecraft-news", icon: IconNews },
    { name: "Обновления", href: "/changelog", icon: IconHistory },
    { name: "Моды", href: "/mods", icon: IconPuzzle },
    { name: "База знаний", href: "/faq", icon: IconHelp },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Логотип и бренд */}
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <div className="w-10 h-10 p-1 bg-card border border-border group-hover:border-primary flex items-center justify-center transition-colors brutalist-shadow-orange">
            <Image
              src="/logo.png"
              width={32}
              height={32}
              alt="RedPanda Launcher Logo"
              className="object-contain transition-transform group-hover:scale-105"
              priority
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base sm:text-lg tracking-wider text-foreground group-hover:text-primary transition-colors">
                REDPANDA
              </span>
              <span className="text-[10px] bg-primary text-black font-bold px-1.5 py-0.5 rounded-none tracking-widest">
                v0.2.2
              </span>
            </div>
            <p className="text-[10px] text-muted tracking-widest uppercase font-mono">MINECRAFT LAUNCHER</p>
          </div>
        </Link>

        {/* Десктопная навигация */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2 font-mono text-xs uppercase tracking-wider">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 xl:px-3.5 xl:py-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? "text-primary font-bold border-b-2 border-primary bg-card/60"
                    : "text-muted hover:text-foreground hover:bg-card/40"
                }`}
              >
                <link.icon size={15} className={isActive ? "text-primary" : "text-muted"} />
                <span>{link.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Правый блок кнопок */}
        <div className="hidden sm:flex items-center gap-2.5 shrink-0">
          <a
            href="https://t.me/redpanda_launcher"
            target="_blank"
            rel="noopener noreferrer"
            title="Telegram Канал"
            className="p-2 bg-card border border-border text-muted hover:text-foreground hover:border-primary transition-colors"
          >
            <IconBrandTelegram size={18} />
          </a>
          <a
            href="https://github.com/t1m0nch1k/RedPanda-Launcher"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub Репозиторий"
            className="p-2 bg-card border border-border text-muted hover:text-foreground hover:border-primary transition-colors"
          >
            <IconBrandGithub size={18} />
          </a>
          <Link
            href="/download"
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-black px-4 py-2 font-display font-bold text-xs uppercase tracking-wider transition-all brutalist-button whitespace-nowrap"
          >
            <IconDownload size={16} />
            <span>Скачать .exe</span>
          </Link>
        </div>

        {/* Мобильная кнопка меню */}
        <div className="lg:hidden flex items-center gap-2">
          <Link
            href="/download"
            className="flex items-center gap-1 bg-primary text-black px-3 py-1.5 font-display font-bold text-xs uppercase"
          >
            <IconDownload size={14} />
            <span>Скачать</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 bg-card border border-border text-foreground hover:text-primary transition-colors"
            aria-label="Переключить меню"
          >
            {mobileMenuOpen ? <IconX size={20} /> : <IconMenu2 size={20} />}
          </button>
        </div>
      </div>

      {/* Мобильное выпадающее меню */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-border bg-card/98 px-4 py-4 space-y-2 backdrop-blur-xl">
          <nav className="flex flex-col space-y-1 font-mono text-xs uppercase">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2.5 flex items-center justify-between border ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-transparent text-muted hover:text-foreground hover:bg-background/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <link.icon size={16} />
                    <span>{link.name}</span>
                  </div>
                  {isActive && <span className="text-[10px] text-primary">● АКТИВНО</span>}
                </Link>
              );
            })}
            <Link
              href="/download"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 flex items-center gap-2 text-primary font-bold border border-primary/30 bg-primary/10 mt-2"
            >
              <IconDownload size={16} />
              <span>Скачать установщик (.exe)</span>
            </Link>
          </nav>

          <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
            <a
              href="https://t.me/redpanda_launcher"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-background border border-border py-2 text-xs text-muted hover:text-foreground"
            >
              <IconBrandTelegram size={16} className="text-sky-400" />
              <span>Telegram</span>
            </a>
            <a
              href="https://github.com/t1m0nch1k/RedPanda-Launcher"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-background border border-border py-2 text-xs text-muted hover:text-foreground"
            >
              <IconBrandGithub size={16} className="text-primary" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
