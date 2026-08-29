import React from "react";
import Link from "next/link";
import Image from "next/image";
import { IconBrandTelegram, IconBrandGithub, IconArrowUpRight, IconShieldCheck, IconCpu, IconRocket } from "@tabler/icons-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/60 pt-16 pb-10 font-mono text-xs">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-border">
          {/* Бренд */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-3.5 group">
              <div className="w-10 h-10 p-1 bg-card border border-border group-hover:border-primary flex items-center justify-center transition-colors brutalist-shadow-orange">
                <Image
                  src="/logo.png"
                  width={32}
                  height={32}
                  alt="RedPanda Launcher Logo"
                  className="object-contain"
                />
              </div>
              <span className="font-display font-bold text-base tracking-wider text-foreground group-hover:text-primary transition-colors">
                REDPANDA LAUNCHER
              </span>
            </Link>
            <p className="text-muted leading-relaxed text-xs max-w-sm">
              Высокопроизводительный Open-Source лаунчер Minecraft нового поколения на стеке Rust & Tauri. Поддержка Modrinth, CurseForge, P2P игра по сети без открытия портов и нулевая реклама.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://t.me/redpanda_launcher"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border text-muted hover:text-foreground hover:border-primary transition-colors text-[11px]"
              >
                <IconBrandTelegram size={14} className="text-sky-400" />
                <span>@redpanda_launcher</span>
              </a>
              <a
                href="https://github.com/t1m0nch1k/RedPanda-Launcher"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border text-muted hover:text-foreground hover:border-primary transition-colors text-[11px]"
              >
                <IconBrandGithub size={14} className="text-primary" />
                <span>GitHub</span>
              </a>
            </div>
          </div>

          {/* Разделы сайта */}
          <div className="space-y-3">
            <p className="font-display font-bold text-foreground text-xs uppercase tracking-wider text-primary">
              // Разделы
            </p>
            <ul className="space-y-2 text-muted">
              <li>
                <Link href="/" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <span>Главная</span>
                </Link>
              </li>
              <li>
                <Link href="/minecraft-news" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <span>Новости Minecraft</span>
                </Link>
              </li>
              <li>
                <Link href="/changelog" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <span>Журнал версий</span>
                </Link>
              </li>
              <li>
                <Link href="/mods" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <span>Каталог модов</span>
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <span>База знаний (FAQ)</span>
                </Link>
              </li>
              <li>
                <Link href="/status" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <span>Статус серверов</span>
                </Link>
              </li>
              <li>
                <Link href="/contacts" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <span>Контакты и поддержка</span>
                </Link>
              </li>
              <li>
                <Link href="/download" className="hover:text-foreground transition-colors flex items-center gap-1 text-primary font-bold">
                  <span>Скачать лаунчер</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Экосистема */}
          <div className="space-y-3">
            <p className="font-display font-bold text-foreground text-xs uppercase tracking-wider text-primary">
              // Технологии
            </p>
            <ul className="space-y-2 text-muted">
              <li className="flex items-center gap-1.5">
                <IconCpu size={14} className="text-primary" />
                <span>Rust & Tauri 2.0</span>
              </li>
              <li className="flex items-center gap-1.5">
                <IconShieldCheck size={14} className="text-emerald-400" />
                <span>AES-256 Vault</span>
              </li>
              <li className="flex items-center gap-1.5">
                <IconRocket size={14} className="text-sky-400" />
                <span>e4mc & Steam P2P</span>
              </li>
              <li>
                <a href="https://modrinth.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <span>Modrinth API</span>
                  <IconArrowUpRight size={12} />
                </a>
              </li>
              <li>
                <a href="https://curseforge.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <span>CurseForge API</span>
                  <IconArrowUpRight size={12} />
                </a>
              </li>
            </ul>
          </div>

          {/* Быстрая загрузка */}
          <div className="space-y-3">
            <p className="font-display font-bold text-foreground text-xs uppercase tracking-wider text-primary">
              // Релиз v0.2.2
            </p>
            <p className="text-muted text-[11px] leading-relaxed">
              Автономный инсталлятор для Windows 10/11 x64.
            </p>
            <Link
              href="/download"
              className="inline-block w-full text-center bg-primary hover:bg-primary-hover text-black py-2.5 px-3 font-display font-bold text-xs uppercase tracking-wider transition-colors brutalist-button"
            >
              Скачать v0.2.2 (.exe)
            </Link>
            <p className="text-[10px] text-muted">Кастомный GUI-инсталлятор · SHA-256 Verified</p>
          </div>
        </div>

        {/* Дисклеймер об авторских правах */}
        <div className="py-4 text-muted text-[10px] leading-relaxed border-b border-border/40">
          Minecraft является зарегистрированным товарным знаком Mojang AB / Microsoft Corporation. RedPanda Launcher не связан с Mojang AB или Microsoft и является независимым проектом с открытым исходным кодом.
        </div>

        {/* Нижняя панель правовой информации (Legal Strip) */}
        <div className="pt-5 flex flex-wrap items-center justify-between gap-y-3 gap-x-6 text-[11px] text-muted">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Конфиденциальность и файлы cookie
            </Link>
            <Link href="/privacy#data" className="hover:text-foreground transition-colors">
              Конфиденциальность данных
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Условия использования
            </Link>
            <Link href="/legal" className="hover:text-foreground transition-colors">
              Товарные знаки
            </Link>
            <Link href="/privacy#ads" className="hover:text-foreground transition-colors">
              О нашей рекламе
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <span>© 2026 RedPanda Launcher</span>
            <Link
              href="/privacy"
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors text-muted"
            >
              {/* Официальный синий бейдж Privacy Options (Check & X) */}
              <svg className="w-5 h-2.5" viewBox="0 0 28 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="28" height="14" rx="7" fill="#0078D4" />
                <path d="M6 7L8 9L12 5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18 5L22 9M22 5L18 9" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Параметры конфиденциальности</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
